import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { createPrismaClient } from '../../src/lib/db';

// Parcours citoyen de la Phase 2. Les signalements créés ici sont supprimés à la fin.
// Chaque processus ne supprime que les siens, par numéro de suivi (colonne indexée) : un
// DELETE sur une colonne non indexée verrouillerait toute la table pendant les autres tests.
const prisma = createPrismaClient();
const createdCodes: string[] = [];

test.afterAll(async () => {
  if (createdCodes.length > 0) {
    await prisma.report.deleteMany({
      where: { isDemo: false, trackingCode: { in: createdCodes } },
    });
  }
  await prisma.$disconnect();
});

/** Position de test proche d'un repère démo, décalée à chaque test (pas de doublon). */
function testPosition() {
  return { latitude: 14.7488 + Math.random() * 0.002, longitude: -17.3812 + Math.random() * 0.002 };
}

const onlyMobile = (projectName: string) => projectName !== 'mobile-375';

/** La carte se monte à l'approche de la zone visible : on la demande explicitement. */
async function showMap(page: Page) {
  const button = page.getByRole('button', { name: 'Afficher la carte' });
  await page.getByText(/signalement\(s\) affiché\(s\)/).waitFor({ timeout: 30_000 });
  if (await button.isVisible()) await button.click();
}

/** Attend que les tuiles visibles du fond de carte soient chargées (captures). */
async function waitForTiles(page: Page) {
  await page
    .waitForFunction(
      () => {
        const tiles = [...document.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
        return tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth > 0);
      },
      undefined,
      { timeout: 20_000, polling: 250 },
    )
    .catch(() => undefined); // tuiles OSM indisponibles : capture quand même
  await page.waitForTimeout(400); // fondu d'apparition des tuiles
}

async function fillReport(page: Page, marker: string) {
  await page.getByRole('button', { name: 'J’ai compris, je signale' }).click();
  await page.getByRole('radio', { name: /Inondation/ }).click();
  await expect(page.getByText('Position trouvée')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('radio', { name: /Forte/ }).click();
  await page.getByLabel('Description (facultatif)').fill(marker);
  // Un habitant met plus de 3 s à remplir le formulaire (anti-robot, D-028) ; compté dans les 60 s.
  await page.waitForTimeout(3000);
}

test.describe('sécurité des habitants (EXG-31)', () => {
  for (const path of ['/', '/signaler']) {
    test(`bouton Urgence sur ${path} : numéros d'abord, en liens d'appel`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole('button', { name: 'Urgence' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Numéros d’urgence' });
      await expect(dialog).toBeVisible();
      for (const [number, tel] of [
        ['18', 'tel:18'],
        ['15', 'tel:15'],
        ['1515', 'tel:1515'],
        ['17', 'tel:17'],
        ['800 00 20 20', 'tel:800002020'],
        ['800 00 17 00', 'tel:800001700'],
      ] as const) {
        await expect(
          dialog.getByRole('link', { name: new RegExp(`^Appeler le ${number} `) }),
        ).toHaveAttribute('href', tel);
      }
    });
  }

  test('le message de sécurité précède le formulaire', async ({ page }) => {
    await page.goto('/signaler');
    await expect(page.getByText('Ne vous mettez pas en danger pour signaler.')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Inondation/ })).toHaveCount(0);
  });
});

test('signaler sans compte en moins de 60 s, en 3G simulée (EXG-01, EXG-02)', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(onlyMobile(testInfo.project.name), 'parcours mobile');
  test.setTimeout(120_000);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 375, height: 812 },
    geolocation: testPosition(),
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  // 3G « lente » de Chrome : 400 ms de latence, ~400 kbit/s.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });

  const marker = `e2e-3g-${randomUUID()}`;
  const start = Date.now();
  await page.goto('/signaler');
  await fillReport(page, marker);
  await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
  const code = page.getByTestId('tracking-code');
  await expect(code).toBeVisible({ timeout: 60_000 });
  const elapsed = Date.now() - start;
  testInfo.annotations.push({ type: 'durée 3G', description: `${(elapsed / 1000).toFixed(1)} s` });
  console.log(`[EXG-01] parcours complet en 3G simulée : ${(elapsed / 1000).toFixed(1)} s`);
  expect(elapsed).toBeLessThan(60_000);

  const trackingCode = (await code.textContent())?.trim() ?? '';
  createdCodes.push(trackingCode);
  const report = await prisma.report.findUniqueOrThrow({ where: { trackingCode } });
  expect(report.authorId).toBeNull();
  expect(report.description).toBe(marker);
  expect(report.neighborhoodId).not.toBeNull();

  // Le signalement se retrouve sur son détail et dans les données de la carte.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.getByRole('link', { name: 'Suivre mon signalement' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Inondation/ })).toBeVisible();
  await expect(page.getByText(trackingCode, { exact: true })).toBeVisible();
  const list = await (await page.request.get('/api/reports')).json();
  expect(list.data.some((r: { trackingCode: string }) => r.trackingCode === trackingCode)).toBe(
    true,
  );
  await context.close();
});

test('hors ligne : signalement mis en file puis envoyé au retour du réseau (EXG-04)', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(onlyMobile(testInfo.project.name), 'parcours mobile');
  test.setTimeout(120_000);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 375, height: 812 },
    geolocation: testPosition(),
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await page.goto('/signaler');
  // Première visite : le service worker s'installe, prend le contrôle et met en cache
  // les ressources déjà chargées par la page (message CACHE_URLS).
  await page.waitForLoadState('networkidle');
  // Le module de carte est préchargé quand le navigateur est inactif : on attend ce moment
  // (les rappels d'inactivité s'exécutent dans l'ordre), puis la fin des téléchargements.
  await page.evaluate(
    () => new Promise((resolve) => requestIdleCallback(() => resolve(null), { timeout: 5000 })),
  );
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(
    async () => {
      if (!navigator.serviceWorker.controller) return false;
      const loaded = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/_next/static/'));
      // Cache de la version courante du service worker (le nom change à chaque version).
      const name = (await caches.keys()).find((key) => key.startsWith('banlieue-alerte-'));
      if (!name) return false;
      const cache = await caches.open(name);
      const cached = new Set((await cache.keys()).map((request) => request.url));
      return loaded.length > 0 && loaded.every((url) => cached.has(url));
    },
    undefined,
    { timeout: 30_000, polling: 500 },
  );

  await context.setOffline(true);
  // La page du formulaire se recharge sans réseau, depuis le cache.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Signaler un problème' })).toBeVisible();
  await expect(page.getByTestId('network-status')).toContainText('Vous êtes hors ligne');

  const marker = `e2e-offline-${randomUUID()}`;
  await fillReport(page, marker);
  await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(
    page.getByRole('heading', { name: 'Signalement enregistré sur votre téléphone' }),
  ).toBeVisible();
  await expect(page.getByTestId('network-status')).toContainText('1 signalement(s) en attente');
  expect(await prisma.report.count({ where: { description: marker } })).toBe(0);

  await context.setOffline(false);
  // Envoi au retour du réseau, ou à la tentative suivante (toutes les 15 s).
  await expect(page.getByText('Signalements en attente envoyés.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('network-status')).toHaveCount(0);
  const synced = await prisma.report.findMany({
    where: { description: marker },
    select: { trackingCode: true },
  });
  createdCodes.push(...synced.map((report) => report.trackingCode));
  expect(synced).toHaveLength(1);
  await context.close();
});

test('carte : marqueurs, filtres, fiche rapide vers le détail', async ({ page }) => {
  await page.goto('/carte');
  // Chargement de Leaflet et des données : plus long quand toute la suite tourne en parallèle.
  await expect(page.getByText(/signalement\(s\) affiché\(s\)/)).toBeVisible({ timeout: 30_000 });
  await showMap(page);
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();

  await page.getByRole('button', { name: 'Filtres' }).click();
  await page.locator('fieldset button', { hasText: 'Route coupée' }).click();
  await expect(page.getByText('1 signalement(s) affiché(s)')).toBeVisible();

  await page.locator('.leaflet-marker-icon .ba-marker--road_cut').first().click();
  await page.locator('.leaflet-popup').getByRole('link', { name: 'Voir le détail' }).click();
  await expect(page).toHaveURL(/\/signalements\/BA-DEMO-0005$/);
  await expect(page.getByText('Quartier non identifié')).toBeVisible();
});

test('détail : données démo marquées, photo, suivi, « Je vois aussi », abus (EXG-16)', async ({
  page,
}) => {
  // Signalement dédié, créé par l'API, pour ne pas modifier les données de démonstration.
  const created = await page.request.post('/api/reports', {
    multipart: {
      type: 'WASTE_DUMP',
      severity: 'LOW',
      lat: String(testPosition().latitude),
      lng: String(testPosition().longitude),
      confirmNotDuplicate: 'true',
    },
  });
  expect(created.status()).toBe(201);
  const { trackingCode } = (await created.json()).data as { trackingCode: string };
  createdCodes.push(trackingCode);

  await page.goto(`/signalements/${trackingCode}`);
  await expect(page.getByText('Suivi du traitement')).toBeVisible();
  await expect(page.getByText('Nouveau').first()).toBeVisible();
  const confirm = page.getByRole('button', { name: /Je vois aussi ce problème/ });
  await confirm.click();
  await expect(page.getByText('Merci, votre confirmation est enregistrée.')).toBeVisible();
  await expect(confirm).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: /Je vois aussi ce problème/ }).click();
  await expect(page.getByText('Vous avez déjà confirmé ce problème.')).toBeVisible();

  await page.getByRole('button', { name: 'Signaler un abus' }).click();
  const dialog = page.getByRole('dialog', { name: 'Signaler un abus' });
  await dialog.getByLabel('Motif').fill('x');
  await dialog.getByRole('button', { name: 'Envoyer' }).click();
  await expect(dialog.getByText('Précisez le motif.')).toBeVisible();
  await dialog.getByLabel('Motif').fill('Faux signalement (test automatisé)');
  await dialog.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Merci, votre demande sera examinée.')).toBeVisible();

  await page.goto('/signalements/BA-DEMO-0001');
  await expect(page.getByText('Données de démonstration').first()).toBeVisible();
  await expect(page.getByRole('img', { name: 'Photo du signalement' })).toBeVisible();

  await page.goto('/signalements/BA-ZZZZ-ZZZZ');
  await expect(page.getByText('Signalement introuvable')).toBeVisible();
});

test('API publiques : positions arrondies, aucune donnée personnelle (EXG-06, EXG-39)', async ({
  request,
}) => {
  const forbidden = [
    'authorId',
    'clientId',
    'voterKey',
    'changedById',
    'passwordHash',
    'email',
    'phone',
    'note',
  ];
  const list = await (await request.get('/api/reports')).json();
  const detail = await (await request.get('/api/reports/BA-DEMO-0001')).json();
  const neighborhoods = await (await request.get('/api/neighborhoods')).json();
  for (const body of [list, detail, neighborhoods]) {
    const json = JSON.stringify(body);
    for (const field of forbidden) expect(json).not.toContain(`"${field}"`);
    expect(json).not.toMatch(/"(lat|lng)":-?\d+\.\d{4,}/);
  }
  expect(JSON.stringify(neighborhoods)).not.toContain('delegate');
});

test('API : photo nettoyée de ses EXIF, faux fichier refusé (EXG-13)', async ({ request }) => {
  const photo = await sharp({
    create: { width: 640, height: 480, channels: 3, background: '#F9B72B' },
  })
    .jpeg()
    .withExif({ IFD0: { Model: 'Modele-Secret-E2E' } })
    .toBuffer();
  const position = testPosition();
  const fields = {
    type: 'BLOCKED_DRAIN',
    severity: 'MEDIUM',
    lat: String(position.latitude),
    lng: String(position.longitude),
    confirmNotDuplicate: 'true',
  };

  const rejected = await request.post('/api/reports', {
    multipart: {
      ...fields,
      photo: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<?php ?>') },
    },
  });
  expect(rejected.status()).toBe(400);

  const created = await request.post('/api/reports', {
    multipart: { ...fields, photo: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: photo } },
  });
  expect(created.status()).toBe(201);
  const { trackingCode } = (await created.json()).data as { trackingCode: string };
  createdCodes.push(trackingCode);
  const detail = (await (await request.get(`/api/reports/${trackingCode}`)).json()).data as {
    photos: { url: string }[];
  };
  const stored = Buffer.from(await (await request.get(detail.photos[0]!.url)).body());
  expect((await sharp(stored).metadata()).exif).toBeUndefined();
  expect(stored.toString('latin1')).not.toContain('Modele-Secret-E2E');
});

test('captures de la Phase 2', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'captures à 375 et 1280 px');
  test.setTimeout(120_000);
  const width = testInfo.project.name === 'mobile-375' ? 375 : 1280;
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height: width === 375 ? 812 : 800 },
    geolocation: { latitude: 14.7488, longitude: -17.3812 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  const shot = async (name: string) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `défilement horizontal sur ${name}`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `docs/screenshots/phase-2/${name}-${width}.png`,
      fullPage: true,
    });
  };

  await page.goto('/');
  await shot('accueil');
  await page.goto('/signaler');
  await shot('signaler-1-securite');
  await page.getByRole('button', { name: 'J’ai compris, je signale' }).click();
  await shot('signaler-2-type');
  await page.getByRole('radio', { name: /Inondation/ }).click();
  await expect(page.getByText('Thiaroye Gare')).toBeVisible({ timeout: 20_000 });
  await waitForTiles(page);
  await shot('signaler-3-position');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await shot('signaler-4-gravite');
  await page.goto('/carte');
  await showMap(page);
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await waitForTiles(page);
  await shot('carte');
  await page.goto('/signalements/BA-DEMO-0001');
  await expect(page.getByRole('img', { name: 'Photo du signalement' })).toBeVisible();
  await shot('detail');
  await page.goto('/urgence');
  await shot('urgence');
  await context.close();
});
