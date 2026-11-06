import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { completeSecondFactor } from './second-factor';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { getPrisma } from '../../src/lib/db';
import type { AuthUser } from '../../src/permissions/types';
import { FixtureWeatherProvider } from '../../src/lib/weather/open-meteo';
import { assignReport, changeStatus } from '../../src/services/backoffice/processing';
import { refreshRisk } from '../../src/services/risk/refresh';

// Phase 5 : carte de risque, retour au citoyen, qualité de l'indice, statistiques, épisodes,
// curage, carte hors ligne, « Apprendre » et tutoriel.
const prisma = getPrisma();
const PASSWORD = process.env.SEED_TEST_PASSWORD ?? '';
const startedAt = new Date();
const createdCodes: string[] = [];
const episodeNames: string[] = [];
const teams: string[] = [];

const ACCOUNTS = {
  citizen: 'habitant.demo@banlieue-alerte.test',
  delegate: 'delegue.demo@banlieue-alerte.test',
  agent: 'agent.demo@banlieue-alerte.test',
  admin: 'admin.demo@banlieue-alerte.test',
} as const;

const ownRunIds: string[] = [];

test.afterAll(async () => {
  if (ownRunIds.length) await prisma.riskRun.deleteMany({ where: { id: { in: ownRunIds } } });
  if (episodeNames.length)
    await prisma.rainEpisode.deleteMany({ where: { name: { in: episodeNames } } });
  if (teams.length) await prisma.cleanupOperation.deleteMany({ where: { team: { in: teams } } });
  if (createdCodes.length)
    await prisma.report.deleteMany({ where: { trackingCode: { in: createdCodes } } });
  await prisma.userNotification.deleteMany({ where: { createdAt: { gte: startedAt } } });
  await prisma.$disconnect();
});

async function loginAs(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(mon-espace|back-office|connexion\/second-facteur)/);
  // Administrateur : second facteur (EXG-41).
  await completeSecondFactor(page, email);
  await page.waitForURL(/\/(mon-espace|back-office)/);
}

async function newSession(browser: Browser, baseURL: string | undefined, email?: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  if (email) await loginAs(page, email);
  return { context, page };
}

/** Petit écran : la carte se charge sur demande (D-061) ; grand écran : toute seule. */
async function showMapIfAsked(page: Page) {
  const show = page.getByRole('button', { name: 'Afficher la carte' });
  if (await show.isVisible()) await show.click({ timeout: 2_000 }).catch(() => undefined);
}

/** Compte de test vu par les services (sans passer par les cookies de Next.js). */
async function serviceUser(email: string): Promise<AuthUser> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      communeId: true,
      locale: true,
      delegatedNeighborhood: { select: { id: true } },
    },
  });
  return { ...user, neighborhoodIds: user.delegatedNeighborhood.map((n) => n.id) };
}

test('carte de risque : le risque en mots, puis les cases hachurées et leurs facteurs', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'vérifiée à 375 et 1280 px');
  test.setTimeout(60_000);
  // Calcul propre à ce test (pluie injectée, sans brouillon) : d'autres fichiers de tests
  // suppriment leurs propres calculs en parallèle, la carte ne doit pas en dépendre.
  const run = await refreshRisk({
    provider: new FixtureWeatherProvider((h) => (h < 0 ? 1 : h < 48 ? 3 : 0)),
    injectedWeather: true,
    trigger: 'test',
    drafts: false,
  });
  ownRunIds.push(run.runId);
  await page.goto('/carte-risque');
  await expect(page.getByTestId('risk-words')).toContainText('Risque');
  await expect(page.getByTestId('risk-map-date')).toContainText('Données météo', {
    timeout: 20_000,
  });
  await showMapIfAsked(page);
  const cells = page.locator('.leaflet-overlay-pane path[fill^="url(#ba-hatch-"]');
  await expect(cells.first()).toBeAttached({ timeout: 15_000 });
  expect(await cells.count()).toBeGreaterThan(100);
  // Chaque niveau a sa couleur et son motif dans la légende.
  await expect(page.getByRole('list', { name: 'Légende' }).getByRole('listitem')).toHaveCount(5);

  // Fiche d'une case : facteurs et date des données.
  await cells.first().click({ force: true });
  await expect(page.locator('.leaflet-popup')).toContainText('Facteurs principaux');

  // Changement d'horizon (les cases rechargées dépendent du dernier calcul, que d'autres
  // tests peuvent créer ou supprimer en parallèle : seul le choix est vérifié ici).
  await page.getByRole('button', { name: 'Demain (de 24 à 48 heures)' }).click();
  await expect(page.getByRole('button', { name: 'Demain (de 24 à 48 heures)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const api = await (await page.request.get('/api/risk/cells?horizon=48')).text();
  expect(api).not.toMatch(/email|author|@banlieue-alerte/);
});

test('retour au citoyen : notification, « non résolu » qui rouvre le dossier (EXG-32)', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'parcours complet une seule fois');
  test.setTimeout(90_000);
  const citizen = await newSession(browser, baseURL, ACCOUNTS.citizen);
  // Signalement fait en étant connecté : rattaché au compte.
  const response = await citizen.page.request.post('/api/reports', {
    headers: { origin: baseURL! },
    multipart: {
      type: 'FLOODING',
      severity: 'MEDIUM',
      lat: String(14.7488 + Math.random() * 0.002),
      lng: '-17.3812',
      description: `e2e-phase5-${randomUUID()}`,
      confirmNotDuplicate: 'true',
    },
  });
  expect(response.status()).toBe(201);
  const code = ((await response.json()).data as { trackingCode: string }).trackingCode;
  createdCodes.push(code);

  // Traitement par l'équipe (services) jusqu'à « Résolu ».
  const delegate = await serviceUser(ACCOUNTS.delegate);
  const agent = await serviceUser(ACCOUNTS.agent);
  await changeStatus(delegate, code, 'VERIFIED');
  await assignReport(agent, code, agent.id);
  await changeStatus(agent, code, 'RESOLVED');

  await citizen.page.goto('/mon-espace');
  await expect(citizen.page.getByTestId('followup-list')).toContainText(code);
  await citizen.page.goto(`/signalements/${code}`);
  const question = citizen.page.getByTestId('resolution-question');
  await expect(question).toContainText('Le problème est-il résolu ?');
  await question.getByRole('button', { name: 'Non, pas encore' }).click();
  await expect(citizen.page.getByText('Merci : le dossier est rouvert')).toBeVisible({
    timeout: 20_000,
  });
  await citizen.page.reload();
  await expect(citizen.page.getByText('Réouvert par l’habitant')).toBeVisible();
  await expect(citizen.page.getByTestId('resolution-question')).toHaveCount(0);

  const report = await prisma.report.findUniqueOrThrow({
    where: { trackingCode: code },
    select: { status: true, resolutionFeedback: true },
  });
  expect(report).toEqual({ status: 'IN_PROGRESS', resolutionFeedback: 'REOPENED' });
  await citizen.context.close();
});

test('qualité de l’indice : état vide explicite, aucune métrique (EXG-12)', async ({ page }) => {
  await page.goto('/qualite-indice');
  await expect(page.getByText('Pas encore assez de données validées')).toBeVisible();
  await expect(page.getByTestId('quality-progress')).toContainText('épisode(s) validé(s) sur 5');
  await expect(page.getByRole('table')).toHaveCount(0);
  const body = (await (await page.request.get('/api/model/performance')).json()) as {
    data: { reached: boolean; results: unknown };
  };
  expect(body.data).toMatchObject({ reached: false, results: null });
});

test('statistiques publiques : tableau réel, données insuffisantes, démo signalée', async ({
  page,
}) => {
  await page.goto('/statistiques');
  await expect(page.getByTestId('stats-table')).toBeVisible();
  await expect(page.getByTestId('stats-table')).toContainText('données insuffisantes');
  // Les lignes calculées sur la seule démonstration portent le badge (d'autres tests peuvent
  // ajouter des signalements réels en parallèle).
  await expect(
    page.getByTestId('stats-table').getByText('Données de démonstration').first(),
  ).toBeVisible();
  // Pied de page : accès aux nouvelles pages publiques.
  await expect(
    page.getByRole('navigation', { name: 'Autres pages' }).getByRole('link'),
  ).toHaveCount(6);
});

test('épisode : l’agent déclare, le délégué étiquette, l’agent valide (D-053)', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'parcours complet une seule fois');
  test.setTimeout(90_000);
  const name = `Épisode e2e ${randomUUID().slice(0, 6)}`;
  episodeNames.push(name);

  const agent = await newSession(browser, baseURL, ACCOUNTS.agent);
  await agent.page.goto('/back-office/episodes');
  await agent.page.getByLabel('Nom de l’épisode').fill(name);
  await agent.page.getByRole('button', { name: 'Déclarer un épisode' }).click();
  await agent.page.waitForURL(/\/back-office\/episodes\/.+/);
  const url = agent.page.url();

  const delegate = await newSession(browser, baseURL, ACCOUNTS.delegate);
  await delegate.page.goto(url);
  await expect(delegate.page.getByText('« Inconnu » par défaut')).toBeVisible();
  const cell = delegate.page.getByTestId('label-cell').first();
  await cell.getByRole('combobox').selectOption('FLOODED');
  await delegate.page.getByRole('button', { name: /Enregistrer les étiquettes/ }).click();
  await expect(delegate.page.getByText('Étiquettes enregistrées.')).toBeVisible();
  // Le délégué ne valide pas : bouton réservé aux agents et administrateurs.
  await expect(delegate.page.getByRole('button', { name: 'Valider l’épisode' })).toHaveCount(0);

  await agent.page.reload();
  await agent.page.getByRole('button', { name: 'Valider l’épisode' }).click();
  await expect(agent.page.getByText('Épisode validé.')).toBeVisible();
  await agent.page.reload();
  await expect(agent.page.getByText('Validé par Agent Démo')).toBeVisible();
  for (const s of [agent, delegate]) await s.context.close();
});

test('curage : liste priorisée et planification par l’agent ; le délégué ne planifie pas', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'une seule fois');
  const team = `Équipe e2e ${randomUUID().slice(0, 6)}`;
  teams.push(team);
  const agent = await newSession(browser, baseURL, ACCOUNTS.agent);
  await agent.page.goto('/back-office/curage');
  const priorities = agent.page.getByTestId('cleanup-priorities');
  await expect(priorities).toContainText('BA-DEMO-0002');
  const item = priorities.getByRole('listitem').filter({ hasText: 'BA-DEMO-0003' });
  await item.getByLabel('Équipe').fill(team);
  await item.getByRole('button', { name: 'Planifier' }).click();
  await expect(agent.page.getByText('Opération planifiée.')).toBeVisible();
  await expect(agent.page.getByTestId('cleanup-operation').filter({ hasText: team })).toBeVisible();

  const delegate = await newSession(browser, baseURL, ACCOUNTS.delegate);
  await delegate.page.goto('/back-office/curage');
  await expect(delegate.page.getByText('Lecture seule')).toBeVisible();
  const refused = await delegate.page.request.post('/api/cleanup', {
    headers: { origin: baseURL! },
    data: { trackingCode: 'BA-DEMO-0002', team: 'Refusée' },
  });
  expect(refused.status()).toBe(403);
  for (const s of [agent, delegate]) await s.context.close();
});

test('carte hors ligne : plan de la zone pilote, message hors zone (EXG-34)', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'une seule fois');
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('/carte');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
  // Le service worker a pris le contrôle et mis le fond de plan en cache.
  await page.waitForFunction(
    async () => {
      if (!navigator.serviceWorker.controller) return false;
      const name = (await caches.keys()).find((key) => key.startsWith('banlieue-alerte-'));
      if (!name) return false;
      return Boolean(await (await caches.open(name)).match('/offline/pilot-map.svg'));
    },
    undefined,
    { timeout: 30_000, polling: 500 },
  );
  // Rechargement en ligne : la page elle-même passe par le service worker et est mise en cache.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(
    async () => {
      const name = (await caches.keys()).find((key) => key.startsWith('banlieue-alerte-'));
      return Boolean(name && (await (await caches.open(name)).match('/carte')));
    },
    undefined,
    { timeout: 15_000, polling: 300 },
  );

  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Carte des signalements' }),
  ).toBeVisible();
  const overlay = page.locator('img.leaflet-image-layer[src="/offline/pilot-map.svg"]');
  await expect(overlay).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('.ba-offline-notice')).toContainText(
    'plan simplifié de la zone pilote',
  );
  // Hors de la zone pilote : message clair.
  // Déplacement au clavier (80 px par appui) jusqu'à sortir de la zone.
  await page.locator('.leaflet-container').focus();
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.ba-offline-notice')).toContainText('seule la zone pilote', {
    timeout: 10_000,
  });
  await context.setOffline(false);
  await context.close();
});

test('Apprendre : quiz corrigé sur l’appareil ; tutoriel ignorable et rejouable (EXG-38)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'vérifié à 375 et 1280 px');
  await page.goto('/');
  const prompt = page.getByTestId('tutorial-prompt');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Ignorer' }).click();
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('tutorial-prompt')).toHaveCount(0);

  await page.goto('/apprendre');
  await page.getByRole('button', { name: 'Revoir le tutoriel' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bienvenue sur Banlieue Alerte' });
  await expect(dialog.getByTestId('tutorial-step')).toContainText('Étape 1 sur 3');
  await dialog.getByRole('button', { name: 'Suivant' }).click();
  await dialog.getByRole('button', { name: 'Suivant' }).click();
  await expect(dialog.getByTestId('tutorial-step')).toContainText('Étape 3 sur 3');
  await dialog.getByRole('button', { name: 'Terminer' }).click();
  await expect(dialog).toBeHidden();

  const quiz = page.getByTestId('quiz-floods');
  await quiz.getByLabel('Parce que le sol est bas et déjà gorgé d’eau').check();
  await quiz.getByLabel('Attendre ou faire un détour par un endroit sec').check();
  await quiz.getByLabel('Le 17').check();
  await quiz.getByRole('button', { name: 'Vérifier' }).click();
  await expect(quiz).toContainText('Score : 2 sur 3');
  await expect(quiz).toContainText('Le 18 joint les sapeurs-pompiers');
});

test('captures de la Phase 5', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'captures à 375 et 1280 px');
  test.setTimeout(120_000);
  const width = testInfo.project.name === 'mobile-375' ? 375 : 1280;
  const viewport = { width, height: width === 375 ? 812 : 800 };
  const shotOf = async (page: Page, name: string) => {
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `défilement horizontal sur ${name}`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `docs/screenshots/phase-5/${name}-${width}.png`,
      fullPage: true,
    });
  };

  const anonymous = await browser.newContext({ baseURL, viewport });
  const page = await anonymous.newPage();
  await page.goto('/carte-risque');
  await showMapIfAsked(page);
  await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached({
    timeout: 15_000,
  });
  await page.waitForTimeout(1_500);
  await shotOf(page, 'carte-risque');
  await page.goto('/carte');
  await shotOf(page, 'carte-resume');
  for (const [path, name] of [
    ['/qualite-indice', 'qualite-indice'],
    ['/statistiques', 'statistiques'],
    ['/apprendre', 'apprendre'],
    ['/', 'accueil-tutoriel'],
  ] as const) {
    await page.goto(path);
    await shotOf(page, name);
  }
  await anonymous.close();

  const citizen = await browser.newContext({ baseURL, viewport });
  const citizenPage = await citizen.newPage();
  await loginAs(citizenPage, ACCOUNTS.citizen);
  await shotOf(citizenPage, 'mon-espace-suivi');
  await citizen.close();

  const agent = await browser.newContext({ baseURL, viewport });
  const agentPage = await agent.newPage();
  await loginAs(agentPage, ACCOUNTS.agent);
  for (const [path, name] of [
    ['/back-office', 'back-office-tableau-de-bord'],
    ['/back-office/curage', 'back-office-curage'],
    ['/back-office/episodes', 'back-office-episodes'],
  ] as const) {
    await agentPage.goto(path);
    await shotOf(agentPage, name);
  }
  await agentPage.getByTestId('episode').first().click();
  await agentPage.waitForURL(/\/back-office\/episodes\/.+/);
  await shotOf(agentPage, 'back-office-episode-etiquettes');
  await agent.close();
});
