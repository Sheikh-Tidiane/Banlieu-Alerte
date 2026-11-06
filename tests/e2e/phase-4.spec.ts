import 'dotenv/config';
import { completeSecondFactor } from './second-factor';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { getPrisma } from '../../src/lib/db';
import { FixtureWeatherProvider } from '../../src/lib/weather/open-meteo';
import type { AuthUser } from '../../src/permissions/types';
import { approveAlert, createAlert } from '../../src/services/alerts/manage';
import { refreshRisk } from '../../src/services/risk/refresh';
import { createAlertSchema } from '../../src/validators/alerts';

// Phase 4 : indice de risque, alertes avec validation humaine, abonnements.
// La forte pluie est injectée depuis le processus de test (relevé marqué « démo ») ; le
// serveur ne voit que la base, comme pour une exécution réelle de la tâche.
const prisma = getPrisma();
const PASSWORD = process.env.SEED_TEST_PASSWORD ?? '';
const startedAt = new Date();
// Nettoyage limité à ce que ce processus a créé : les tailles d'écran tournent en parallèle.
const alertIds: string[] = [];
const runIds: string[] = [];
let createdSubscription = false;
let adminRefresh = false;

const ACCOUNTS = {
  citizen: 'habitant.demo@banlieue-alerte.test',
  delegate: 'delegue.demo@banlieue-alerte.test',
  agent: 'agent.demo@banlieue-alerte.test',
  admin: 'admin.demo@banlieue-alerte.test',
} as const;

const heavyRain = new FixtureWeatherProvider((h) => (h < 0 ? 2 : h < 24 ? 5 : 0));

test.afterAll(async () => {
  await prisma.alert.deleteMany({
    where: { OR: [{ id: { in: alertIds } }, { riskPrediction: { runId: { in: runIds } } }] },
  });
  await prisma.riskRun.deleteMany({ where: { id: { in: runIds } } });
  if (adminRefresh) {
    await prisma.riskRun.deleteMany({ where: { trigger: 'admin', createdAt: { gte: startedAt } } });
  }
  if (createdSubscription) {
    await prisma.subscription.deleteMany({
      where: { isDemo: false, user: { email: ACCOUNTS.citizen }, createdAt: { gte: startedAt } },
    });
  }
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

async function neighborhoodId(name: string) {
  return (
    await prisma.neighborhood.findFirstOrThrow({
      where: { name, isDemo: true },
      select: { id: true },
    })
  ).id;
}

test('forte pluie : brouillon de l’indice → approbation par l’agent → notification de l’abonné', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'parcours complet une seule fois');
  test.setTimeout(120_000);
  const surMer = await neighborhoodId('Thiaroye sur Mer');

  // 1. L'habitant s'abonne à Thiaroye sur Mer (EXG-11).
  const citizen = await newSession(browser, baseURL, ACCOUNTS.citizen);
  await citizen.page.goto('/s-abonner');
  await expect(citizen.page.getByText(/^Mode simulation :/)).toBeVisible();
  await citizen.page.getByRole('checkbox', { name: /Thiaroye sur Mer/ }).check();
  await citizen.page.getByRole('checkbox', { name: /Notification web/ }).check();
  createdSubscription = true;
  await citizen.page.getByRole('button', { name: 'M’abonner' }).click();
  await citizen.page.waitForURL(/\/mon-espace/);
  await expect(
    citizen.page
      .getByTestId('subscription')
      .filter({ has: citizen.page.getByText('Thiaroye sur Mer', { exact: true }) }),
  ).toBeVisible();

  // 2. La tâche calcule l'indice : brouillon indicatif en attente, aucun envoi (EXG-29).
  const result = await refreshRisk({ provider: heavyRain, injectedWeather: true, trigger: 'test' });
  runIds.push(result.runId);
  expect(result.draftsCreated).toBeGreaterThanOrEqual(1);
  const draft = await prisma.alert.findFirstOrThrow({
    where: {
      origin: 'RISK_INDEX',
      status: 'PENDING_APPROVAL',
      riskPrediction: { runId: result.runId },
      neighborhoods: { some: { neighborhoodId: surMer } },
    },
    select: { id: true, _count: { select: { deliveries: true } } },
  });
  expect(draft._count.deliveries).toBe(0);
  await citizen.page.goto('/alertes');
  await expect(citizen.page.getByText('Météo injectée pour la démonstration')).toBeVisible();
  await expect(
    citizen.page.locator('[data-alert-type]').filter({ hasText: 'Thiaroye sur Mer' }),
  ).toHaveCount(0);

  // 3. L'agent relit, corrige le titre et approuve (EXG-10).
  const agent = await newSession(browser, baseURL, ACCOUNTS.agent);
  await agent.page.goto('/back-office/alertes?statut=PENDING_APPROVAL');
  await agent.page
    .getByTestId('staff-alert')
    .filter({ hasText: 'Thiaroye sur Mer' })
    .first()
    .click();
  await agent.page.waitForURL(new RegExp(`/back-office/alertes/${draft.id}$`));
  await expect(agent.page.getByText('Brouillon créé par l’indice')).toBeVisible();
  await expect(agent.page.getByText(/^Mode simulation :/)).toBeVisible();
  await agent.page.getByLabel('Titre').fill('Risque élevé de fortes eaux – Thiaroye sur Mer (e2e)');
  await agent.page.getByRole('button', { name: 'Approuver et envoyer' }).click();
  await expect(agent.page.getByText('Alerte approuvée.')).toBeVisible();
  await expect(agent.page.getByTestId('alert-decisions')).toContainText('Approuvée par Agent Démo');
  await expect(agent.page.getByTestId('alert-deliveries')).toContainText('remise (in_app)');
  await expect(agent.page.getByTestId('alert-deliveries')).toContainText('simulée (simulation)');

  // 4. L'habitant reçoit la notification ; l'alerte publique est indicative (EXG-30).
  await citizen.page.goto('/mon-espace');
  await expect(
    citizen.page.getByTestId('notification').filter({ hasText: 'Thiaroye sur Mer (e2e)' }).first(),
  ).toBeVisible();
  await citizen.page.goto('/alertes');
  const card = citizen.page.locator('[data-alert-type="INDICATIVE"]').filter({ hasText: '(e2e)' });
  await expect(card).toContainText('Indicatif – ne remplace pas les alertes officielles.');
  await expect(card).not.toContainText('Alerte officielle');
  await expect(card.getByRole('link', { name: 'Partager sur WhatsApp' })).toHaveCount(0);

  const audit = await prisma.auditLog.findMany({
    where: { entityId: draft.id },
    select: { action: true },
  });
  expect(audit.map((a) => a.action)).toEqual(
    expect.arrayContaining(['alert.draft_created', 'alert.approved', 'alert.sent']),
  );
  for (const s of [citizen, agent]) await s.context.close();
});

test('alerte officielle : présentation distincte et partage limité', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'affichage vérifié à 375 et 1280 px');
  const agent = await serviceUser(ACCOUNTS.agent);
  const created = await createAlert(
    agent,
    createAlertSchema.parse({
      type: 'OFFICIAL',
      level: 'HIGH',
      issuerName: 'Émetteur officiel de test (fictif)',
      title: `Test e2e officiel ${testInfo.project.name}`,
      messageFr: 'Test : message officiel fictif pour les tests automatisés.',
      neighborhoodIds: [await neighborhoodId('Thiaroye Gare')],
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  );
  alertIds.push(created.id);
  await approveAlert(agent, created.id, {});

  await page.goto('/alertes');
  const card = page.locator('[data-alert-type="OFFICIAL"]').filter({
    hasText: `Test e2e officiel ${testInfo.project.name}`,
  });
  await expect(card).toContainText('Alerte officielle');
  await expect(card).toContainText('Émetteur officiel de test (fictif)');
  await expect(card).not.toContainText('Indicatif');
  await expect(card.getByRole('link', { name: 'Partager sur WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=/,
  );
  // Bouton Urgence présent sur la page des alertes (EXG-31).
  await expect(page.getByRole('main').getByRole('button', { name: 'Urgence' })).toBeVisible();
});

test('refus d’accès aux alertes et au recalcul (EXG-30, EXG-05)', async ({ browser, baseURL }) => {
  // Trois connexions et une vingtaine de requêtes : plus long quand toute la suite tourne.
  test.setTimeout(90_000);
  const origin = { origin: baseURL! };
  const gare = await neighborhoodId('Thiaroye Gare');
  const diamaguene = await neighborhoodId('Diamaguène');
  const body = (overrides: Record<string, unknown> = {}) => ({
    type: 'OFFICIAL',
    level: 'HIGH',
    issuerName: 'Mairie (test)',
    title: 'Test de refus',
    messageFr: 'Test de refus d’accès.',
    neighborhoodIds: [gare],
    validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  });

  const anonymous = await newSession(browser, baseURL);
  expect(
    (await anonymous.page.request.post('/api/alerts', { headers: origin, data: body() })).status(),
  ).toBe(401);
  expect(
    (
      await anonymous.page.request.post('/api/subscriptions', { headers: origin, data: {} })
    ).status(),
  ).toBe(401);

  const citizen = await newSession(browser, baseURL, ACCOUNTS.citizen);
  expect(
    (await citizen.page.request.post('/api/alerts', { headers: origin, data: body() })).status(),
  ).toBe(403);
  await citizen.page.goto('/back-office/alertes');
  await expect(citizen.page).toHaveURL(/\/acces-refuse$/);

  const delegate = await newSession(browser, baseURL, ACCOUNTS.delegate);
  // Officielle : refusée au délégué ; indicative hors de son quartier : refusée.
  expect(
    (await delegate.page.request.post('/api/alerts', { headers: origin, data: body() })).status(),
  ).toBe(403);
  const outside = await delegate.page.request.post('/api/alerts', {
    headers: origin,
    data: body({ type: 'INDICATIVE', issuerName: 'Délégué (test)', neighborhoodIds: [diamaguene] }),
  });
  expect(outside.status()).toBe(403);
  // Recalcul et grille : administrateur seulement ; secret de planification invalide refusé.
  expect(
    (await delegate.page.request.post('/api/jobs/risk-refresh', { headers: origin })).status(),
  ).toBe(403);
  expect(
    (
      await anonymous.page.request.post('/api/jobs/risk-refresh', {
        headers: { authorization: 'Bearer faux' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await delegate.page.request.post('/api/admin/rules', {
        headers: origin,
        data: { action: 'activate', versionId: 'x' },
      })
    ).status(),
  ).toBe(403);

  // Les API publiques ne contiennent ni créateur, ni approbateur, ni position d'abonné.
  const publicJson = [
    await (await anonymous.page.request.get('/api/alerts/active')).text(),
    await (await anonymous.page.request.get('/api/risk/forecast?horizon=48')).text(),
    await (await anonymous.page.request.get('/api/weather')).text(),
  ].join('');
  expect(publicJson).not.toMatch(/createdBy|approver|email|@banlieue-alerte|subscription/i);
  expect((await anonymous.page.request.get('/api/risk/forecast?horizon=12')).status()).toBe(400);

  for (const s of [anonymous, citizen, delegate]) await s.context.close();
});

test('abonnement sans compte : invitation à se connecter, signalement toujours ouvert', async ({
  page,
}) => {
  await page.goto('/s-abonner');
  await expect(page.getByText('Un compte est nécessaire pour recevoir les alertes.')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
    'href',
    '/connexion?suite=%2Fs-abonner',
  );
});

test('indice : l’administrateur recalcule avec la vraie météo et voit les versions', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'une seule fois (appel réel à Open-Meteo)');
  // Appel réel à Open-Meteo : le délai dépend du réseau.
  test.setTimeout(120_000);
  const admin = await newSession(browser, baseURL, ACCOUNTS.admin);
  await admin.page.goto('/back-office/indice');
  await expect(admin.page.getByTestId('rule-version').filter({ hasText: 'Active' })).toHaveCount(1);
  adminRefresh = true;
  await admin.page.getByRole('button', { name: 'Recalculer maintenant' }).click();
  await expect(admin.page.getByText('Indice recalculé.')).toBeVisible({ timeout: 60_000 });
  // Vérifié en base : d'autres tests peuvent créer un calcul plus récent en parallèle.
  const adminRun = await prisma.riskRun.findFirst({
    where: { trigger: 'admin', createdAt: { gte: startedAt } },
    select: { weatherSnapshot: { select: { source: true } } },
  });
  expect(adminRun?.weatherSnapshot?.source).toBe('Open-Meteo');
  await admin.context.close();
});

test('captures de la Phase 4', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'captures à 375 et 1280 px');
  // Connexion administrateur : le code du second facteur peut attendre une période libre.
  test.setTimeout(180_000);
  const width = testInfo.project.name === 'mobile-375' ? 375 : 1280;
  const viewport = { width, height: width === 375 ? 812 : 800 };
  const shotOf = async (page: Page, name: string) => {
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `défilement horizontal sur ${name}`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `docs/screenshots/phase-4/${name}-${width}.png`,
      fullPage: true,
    });
  };

  // Épisode de pluie injecté (marqué « démo » à l'écran) pour montrer un risque élevé ;
  // sans brouillon, pour ne pas interférer avec le parcours d'approbation.
  const run = await refreshRisk({
    provider: heavyRain,
    injectedWeather: true,
    trigger: 'test',
    drafts: false,
  });
  runIds.push(run.runId);

  const anonymous = await browser.newContext({ baseURL, viewport });
  const page = await anonymous.newPage();
  await page.goto('/');
  await shotOf(page, 'accueil-risque');
  await page.goto('/alertes');
  await shotOf(page, 'alertes');
  await anonymous.close();

  const citizen = await browser.newContext({ baseURL, viewport });
  const citizenPage = await citizen.newPage();
  await loginAs(citizenPage, ACCOUNTS.citizen);
  await citizenPage.goto('/s-abonner');
  await shotOf(citizenPage, 's-abonner');
  await citizenPage.goto('/mon-espace');
  await shotOf(citizenPage, 'mon-espace-notifications');
  await citizen.close();

  const agent = await browser.newContext({ baseURL, viewport });
  const agentPage = await agent.newPage();
  await loginAs(agentPage, ACCOUNTS.agent);
  await agentPage.goto('/back-office/alertes');
  await shotOf(agentPage, 'back-office-alertes');
  await agentPage.goto('/back-office/alertes?statut=PENDING_APPROVAL');
  await agentPage.getByTestId('staff-alert').first().click();
  await agentPage.waitForURL(/\/back-office\/alertes\/.+/);
  await shotOf(agentPage, 'back-office-alerte-fiche');
  await agentPage.goto('/back-office/alertes/nouvelle');
  await shotOf(agentPage, 'back-office-alerte-nouvelle');
  await agent.close();

  const admin = await browser.newContext({ baseURL, viewport });
  const adminPage = await admin.newPage();
  await loginAs(adminPage, ACCOUNTS.admin);
  await adminPage.goto('/back-office/indice');
  await shotOf(adminPage, 'back-office-indice');
  await admin.close();
});
