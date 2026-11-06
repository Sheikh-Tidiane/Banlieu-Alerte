import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { completeSecondFactor } from './second-factor';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createPrismaClient } from '../../src/lib/db';

// Phase 3 : comptes, droits, invitations, traitement au back-office, espace citoyen.
const prisma = createPrismaClient();
const PASSWORD = process.env.SEED_TEST_PASSWORD ?? '';
const createdCodes: string[] = [];
const createdEmails: string[] = [];

const ACCOUNTS = {
  citizen: 'habitant.demo@banlieue-alerte.test',
  delegate: 'delegue.demo@banlieue-alerte.test',
  agent: 'agent.demo@banlieue-alerte.test',
  admin: 'admin.demo@banlieue-alerte.test',
} as const;

test.afterAll(async () => {
  if (createdCodes.length)
    await prisma.report.deleteMany({ where: { trackingCode: { in: createdCodes } } });
  if (createdEmails.length) {
    const users = await prisma.user.findMany({
      where: { email: { in: createdEmails } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.neighborhood.updateMany({
      where: { delegateId: { in: ids } },
      data: { delegateId: null },
    });
    await prisma.invitation.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  // Comptes supprimés pendant les tests (anonymisés, plus d'e-mail).
  await prisma.user.deleteMany({
    where: { status: 'DELETED', isDemo: false, reports: { none: {} }, comments: { none: {} } },
  });
  const delegate = await prisma.user.findUnique({
    where: { email: ACCOUNTS.delegate },
    select: { id: true },
  });
  if (delegate) {
    await prisma.neighborhood.updateMany({
      where: { name: 'Thiaroye Gare', isDemo: true },
      data: { delegateId: delegate.id },
    });
  }
  await prisma.$disconnect();
});

async function loginAs(page: Page, email: string, password = PASSWORD) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
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

/** Signalement sans compte créé par l'API publique, près d'un repère de Thiaroye Gare. */
async function createAnonymousReport(page: Page) {
  const response = await page.request.post('/api/reports', {
    multipart: {
      type: 'FLOODING',
      severity: 'HIGH',
      lat: String(14.7488 + Math.random() * 0.002),
      lng: '-17.3812',
      description: `e2e-phase3-${randomUUID()}`,
      confirmNotDuplicate: 'true',
    },
  });
  expect(response.status()).toBe(201);
  const { trackingCode } = (await response.json()).data as { trackingCode: string };
  createdCodes.push(trackingCode);
  return trackingCode;
}

test('connexion avec les 4 comptes de test (EXG-40), cookie httpOnly et SameSite=Lax', async ({
  browser,
  baseURL,
}) => {
  // Le second facteur de l'administrateur peut attendre une période de 30 s (codes à usage unique).
  test.setTimeout(90_000);
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    const { context, page } = await newSession(browser, baseURL, email);
    await expect(page).toHaveURL(
      role === 'citizen' ? /\/mon-espace$/ : /\/mon-espace$|\/back-office/,
    );
    const cookie = (await context.cookies()).find((c) => c.name === 'ba_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    await context.close();
  }
});

test('mauvais mot de passe : message générique, pas de session', async ({ page, context }) => {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(ACCOUNTS.agent);
  await page.getByLabel('Mot de passe').fill('pas-le-bon-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible();
  expect((await context.cookies()).some((c) => c.name === 'ba_session')).toBe(false);
});

test('parcours prioritaire : signalement sans compte → vérifié → assigné → résolu, visible publiquement', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'parcours complet une seule fois');
  test.setTimeout(120_000);
  const anonymous = await newSession(browser, baseURL);
  const code = await createAnonymousReport(anonymous.page);

  const delegate = await newSession(browser, baseURL, ACCOUNTS.delegate);
  await delegate.page.goto(`/back-office/signalements/${code}`);
  await delegate.page.getByLabel('Nouveau statut').selectOption('VERIFIED');
  await delegate.page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(delegate.page.getByText('Statut mis à jour.')).toBeVisible();
  // Le délégué ne peut pas assigner : le formulaire n'est pas proposé.
  await expect(delegate.page.getByRole('button', { name: 'Assigner' })).toHaveCount(0);

  const agent = await newSession(browser, baseURL, ACCOUNTS.agent);
  await agent.page.goto(`/back-office/signalements/${code}`);
  await agent.page.getByRole('button', { name: 'M’assigner' }).click();
  await expect(agent.page.getByText('Signalement assigné.')).toBeVisible();
  await agent.page
    .getByLabel('Ajouter une note (jamais publiée)')
    .fill('Note interne e2e : passage prévu.');
  await agent.page.getByRole('button', { name: 'Ajouter la note' }).click();
  await expect(agent.page.getByText('Note interne e2e : passage prévu.')).toBeVisible();
  for (const [status, label] of [
    ['IN_PROGRESS', 'En cours'],
    ['RESOLVED', 'Résolu'],
  ] as const) {
    await agent.page.getByLabel('Nouveau statut').selectOption(status);
    await agent.page.getByRole('button', { name: 'Appliquer' }).click();
    // Le badge d'en-tête de la fiche reflète le nouveau statut.
    await expect(
      agent.page.locator('h2').locator('..').getByText(label, { exact: true }).first(),
    ).toBeVisible();
  }

  await anonymous.page.goto(`/signalements/${code}`);
  const timeline = anonymous.page
    .getByRole('list')
    .filter({ has: anonymous.page.getByText('Résolu') });
  await expect(anonymous.page.getByText('Résolu').first()).toBeVisible();
  for (const label of ['Nouveau', 'Vérifié', 'Assigné', 'En cours', 'Résolu']) {
    await expect(timeline.getByText(label, { exact: true })).toBeVisible();
  }
  // Les données internes ne sont jamais publiques.
  await expect(anonymous.page.getByText('Note interne e2e')).toHaveCount(0);
  const api = await (await anonymous.page.request.get(`/api/reports/${code}`)).text();
  expect(api).not.toMatch(/Note interne|assignee|Agent Démo/);

  for (const s of [anonymous, delegate, agent]) await s.context.close();
});

test.describe('refus d’accès (EXG-05, D-035)', () => {
  test('back-office : connexion requise, citoyen refusé', async ({ browser, baseURL }) => {
    const anonymous = await newSession(browser, baseURL);
    await anonymous.page.goto('/back-office');
    await expect(anonymous.page).toHaveURL(/\/connexion\?suite=/);
    const citizen = await newSession(browser, baseURL, ACCOUNTS.citizen);
    await citizen.page.goto('/back-office/signalements');
    await expect(citizen.page).toHaveURL(/\/acces-refuse$/);
    const delegate = await newSession(browser, baseURL, ACCOUNTS.delegate);
    await delegate.page.goto('/back-office/utilisateurs');
    await expect(delegate.page).toHaveURL(/\/acces-refuse$/);
    for (const s of [anonymous, citizen, delegate]) await s.context.close();
  });

  test('API : 401 sans session, 403 hors rôle, hors portée ou autre origine', async ({
    browser,
    baseURL,
  }) => {
    const anonymous = await newSession(browser, baseURL);
    const code = await createAnonymousReport(anonymous.page);
    const origin = { origin: baseURL! };
    const patch = (page: Page, target: string, headers: Record<string, string> = origin) =>
      page.request.patch(`/api/reports/${target}/status`, {
        headers,
        data: { status: 'VERIFIED' },
      });

    expect((await patch(anonymous.page, code)).status()).toBe(401);

    const citizen = await newSession(browser, baseURL, ACCOUNTS.citizen);
    expect((await patch(citizen.page, code)).status()).toBe(403);
    expect((await citizen.page.request.get('/api/invitations')).status()).toBe(403);

    const delegate = await newSession(browser, baseURL, ACCOUNTS.delegate);
    // BA-DEMO-0004 est à Diamaguène, hors du quartier du délégué de démonstration.
    expect((await patch(delegate.page, 'BA-DEMO-0004')).status()).toBe(403);
    // Requête venant d'un autre site : refusée même avec une session valide (CSRF).
    expect(
      (await patch(delegate.page, code, { origin: 'https://site-malveillant.example' })).status(),
    ).toBe(403);
    expect((await patch(delegate.page, code, {})).status()).toBe(403);

    const register = await anonymous.page.request.post('/api/auth/register', {
      headers: origin,
      data: {
        name: 'Pirate',
        email: `pirate-${randomUUID()}@banlieue-alerte.test`,
        password: 'mot-de-passe-long',
        role: 'ADMIN',
      },
    });
    expect(register.status()).toBe(400);

    for (const s of [anonymous, citizen, delegate]) await s.context.close();
  });
});

test('invitation : l’administrateur invite, le délégué active son compte, la révocation est immédiate (EXG-33)', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'une seule fois');
  test.setTimeout(90_000);
  const admin = await newSession(browser, baseURL, ACCOUNTS.admin);
  await admin.page.goto('/back-office/utilisateurs');
  const email = `delegue-${randomUUID().slice(0, 8)}@banlieue-alerte.test`;
  createdEmails.push(email);
  await admin.page.getByLabel('Adresse e-mail').fill(email);
  await admin.page.getByLabel('Rôle').selectOption('DELEGATE');
  await admin.page.getByLabel('Quartier (délégué)').selectOption({ label: 'Diamaguène' });
  await admin.page.getByRole('button', { name: 'Créer l’invitation' }).click();
  const link = (await admin.page.getByTestId('one-time-link').textContent())?.trim() ?? '';
  expect(link).toContain('/invitation/');
  await expect(admin.page.getByText('Mode simulation : aucun e-mail n’est envoyé.')).toBeVisible();

  const invited = await newSession(browser, baseURL);
  await invited.page.goto(new URL(link).pathname);
  await expect(invited.page.getByText('Délégué de quartier · Diamaguène')).toBeVisible();
  await invited.page.getByLabel('Nom').fill('Délégué Invité');
  await invited.page.getByLabel('Mot de passe').fill('mot-de-passe-invite');
  await invited.page.getByRole('button', { name: 'Activer mon compte' }).click();
  await invited.page.waitForURL(/\/back-office$/);
  await expect(invited.page.getByText('Délégué de quartier').first()).toBeVisible();

  // Le lien ne sert qu'une fois.
  const again = await newSession(browser, baseURL);
  await again.page.goto(new URL(link).pathname);
  await expect(again.page.getByText('Invitation invalide')).toBeVisible();

  // Révocation : une seconde invitation est révoquée, puis refusée.
  const second = `agent-${randomUUID().slice(0, 8)}@banlieue-alerte.test`;
  createdEmails.push(second);
  await admin.page.getByLabel('Adresse e-mail').fill(second);
  await admin.page.getByLabel('Rôle').selectOption('AGENT');
  await admin.page.getByRole('button', { name: 'Créer l’invitation' }).click();
  await expect(admin.page.getByRole('listitem').filter({ hasText: second })).toBeVisible();
  const revokedLink = (await admin.page.getByTestId('one-time-link').textContent())?.trim() ?? '';
  await admin.page
    .getByRole('listitem')
    .filter({ hasText: second })
    .getByRole('button', { name: 'Révoquer' })
    .click();
  await expect(admin.page.getByText('Invitation révoquée.')).toBeVisible();
  await again.page.goto(new URL(revokedLink).pathname);
  await expect(again.page.getByText('Invitation invalide')).toBeVisible();

  for (const s of [admin, invited, again]) await s.context.close();
});

test('espace citoyen : inscription, signalement rattaché, commentaire, export, suppression', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-375', 'parcours mobile');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const email = `habitant-${randomUUID().slice(0, 8)}@banlieue-alerte.test`;
  createdEmails.push(email);

  await page.goto('/inscription');
  await page.getByLabel('Nom').fill('Habitant E2E');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL(/\/mon-espace$/);
  await expect(
    page.getByText('Vous n’avez pas encore fait de signalement avec ce compte.'),
  ).toBeVisible();

  // Signalement fait en étant connecté : rattaché au compte.
  const created = await page.request.post('/api/reports', {
    headers: { origin: baseURL! },
    multipart: {
      type: 'WASTE_DUMP',
      severity: 'LOW',
      lat: '14.741',
      lng: '-17.364',
      confirmNotDuplicate: 'true',
    },
  });
  const { trackingCode } = (await created.json()).data as { trackingCode: string };
  createdCodes.push(trackingCode);
  await page.reload();
  await expect(page.getByText(trackingCode)).toBeVisible();

  await page.goto(`/signalements/${trackingCode}`);
  await page.getByLabel('Votre commentaire').fill('Commentaire e2e : toujours présent ce soir.');
  await page.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Commentaire e2e : toujours présent ce soir.')).toBeVisible();
  // Le nom de l'auteur n'est pas publié (l'en-tête, lui, affiche le compte connecté).
  await expect(
    page.getByRole('region', { name: 'Commentaires' }).getByText('Habitant E2E'),
  ).toHaveCount(0);

  const exported = await page.request.get('/api/account');
  expect(exported.headers()['content-disposition']).toContain('attachment');
  const data = await exported.json();
  expect(data.account.email).toBe(email);
  expect(data.reports.map((r: { trackingCode: string }) => r.trackingCode)).toContain(trackingCode);

  await page.goto('/mon-espace');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await page.getByRole('textbox', { name: 'SUPPRIMER' }).fill('SUPPRIMER');
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer mon compte' }).click();
  await page.waitForURL(/\/$/);
  const report = await prisma.report.findUniqueOrThrow({ where: { trackingCode } });
  expect(report.authorId).toBeNull();
  // Le compte supprimé ne peut plus se connecter.
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible();
  await context.close();
});

test('modération : un commentaire signalé est masqué par le délégué', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'une seule fois');
  test.setTimeout(90_000);
  const citizen = await newSession(browser, baseURL, ACCOUNTS.citizen);
  const code = await createAnonymousReport(citizen.page);
  const body = `Commentaire à modérer ${randomUUID().slice(0, 6)}`;
  const comment = await citizen.page.request.post(`/api/reports/${code}/comments`, {
    headers: { origin: baseURL! },
    data: { body },
  });
  expect(comment.status()).toBe(201);
  const { id } = (await comment.json()).data as { id: string };
  const flagged = await citizen.page.request.post(`/api/comments/${id}/abuse`, {
    headers: { origin: baseURL! },
    data: { reason: 'Propos injurieux (test)' },
  });
  expect(flagged.status()).toBe(201);

  const delegate = await newSession(browser, baseURL, ACCOUNTS.delegate);
  await delegate.page.goto('/back-office/moderation');
  const item = delegate.page.getByRole('listitem').filter({ hasText: body });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Masquer le commentaire' }).click();
  await expect(delegate.page.getByText('Action enregistrée.')).toBeVisible();

  await citizen.page.goto(`/signalements/${code}`);
  await expect(citizen.page.getByText(body)).toHaveCount(0);
  for (const s of [citizen, delegate]) await s.context.close();
});

test('captures de la Phase 3', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'captures à 375 et 1280 px');
  test.setTimeout(180_000);
  const width = testInfo.project.name === 'mobile-375' ? 375 : 1280;
  const shotOf = async (page: Page, name: string) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `défilement horizontal sur ${name}`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `docs/screenshots/phase-3/${name}-${width}.png`,
      fullPage: true,
    });
  };
  const viewport = { width, height: width === 375 ? 812 : 800 };

  const anonymous = await browser.newContext({ baseURL, viewport });
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto('/connexion');
  await shotOf(anonymousPage, 'connexion');
  await anonymousPage.goto('/inscription');
  await shotOf(anonymousPage, 'inscription');
  await anonymous.close();

  const citizen = await browser.newContext({ baseURL, viewport });
  const citizenPage = await citizen.newPage();
  await loginAs(citizenPage, ACCOUNTS.citizen);
  await shotOf(citizenPage, 'mon-espace');
  await citizenPage.goto('/signalements/BA-DEMO-0001');
  await expect(citizenPage.getByText('Commentaires')).toBeVisible();
  await shotOf(citizenPage, 'detail-commentaires');
  await citizen.close();

  const admin = await browser.newContext({ baseURL, viewport });
  const adminPage = await admin.newPage();
  await loginAs(adminPage, ACCOUNTS.admin);
  for (const [path, name] of [
    ['/back-office', 'back-office-tableau-de-bord'],
    ['/back-office/signalements', 'back-office-signalements'],
    ['/back-office/signalements/BA-DEMO-0001', 'back-office-fiche'],
    ['/back-office/moderation', 'back-office-moderation'],
    ['/back-office/utilisateurs', 'back-office-utilisateurs'],
    ['/back-office/zones', 'back-office-zones'],
    ['/back-office/journal', 'back-office-journal'],
  ] as const) {
    await adminPage.goto(path);
    await adminPage.waitForLoadState('networkidle');
    await shotOf(adminPage, name);
  }
  await admin.close();
});
