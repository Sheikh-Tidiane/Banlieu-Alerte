import 'dotenv/config';
import { expect, test, type Page } from '@playwright/test';
import { completeSecondFactor } from './second-factor';

// Phase 6 : en-têtes de sécurité, second facteur de l'administrateur, supervision,
// mode démonstration désactivé par défaut, navigation au clavier.
const PASSWORD = process.env.SEED_TEST_PASSWORD ?? '';
const ADMIN = 'admin.demo@banlieue-alerte.test';

async function loginWithoutSecondFactor(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('en-têtes de sécurité en production (D-066)', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response!.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).not.toContain('unsafe-eval');
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('administrateur : aucun droit sans second facteur (EXG-41)', async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'une seule fois');
  test.setTimeout(90_000);
  await loginWithoutSecondFactor(page, ADMIN);
  await page.waitForURL(/\/connexion\/second-facteur/);
  await expect(page.getByRole('heading', { level: 1, name: 'Second facteur' })).toBeVisible();

  // Sans code : le back-office renvoie vers le second facteur, et les API d'équipe refusent.
  await page.goto('/back-office/supervision');
  await expect(page).toHaveURL(/\/connexion\/second-facteur\?suite=/);
  const refused = await page.request.post('/api/admin/rules', {
    headers: { origin: baseURL! },
    data: { action: 'activate', versionId: 'x' },
  });
  expect(refused.status()).toBe(403);
  expect(await refused.text()).toContain('Second facteur requis');

  // Code faux refusé.
  await page.getByLabel('Code à 6 chiffres').fill('000000');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Code incorrect ou déjà utilisé.')).toBeVisible();

  // Bon code : accès au back-office (le gabarit du back-office renvoie vers son accueil).
  await completeSecondFactor(page, ADMIN);
  await expect(page).toHaveURL(/\/back-office/);
  await page.goto('/back-office/supervision');
  await expect(page.getByTestId('health-checks')).toContainText('Base de données');
});

test('mode démonstration désactivé par défaut : simulateur et page absents (D-063)', async ({
  page,
  baseURL,
}) => {
  const response = await page.request.post('/api/demo/simulate-rain', {
    headers: { origin: baseURL! },
  });
  expect(response.status()).toBe(404);
  await page.goto('/');
  await expect(page.getByText('Mode démonstration : les données marquées')).toHaveCount(0);
});

test('point de santé : compteurs et dates seulement (EXG-37)', async ({ page }) => {
  const response = await page.request.get('/api/health');
  expect(response.status()).toBe(200);
  const body = await response.text();
  const json = JSON.parse(body) as { checks: Record<string, string>; notificationsMode: string };
  expect(json.checks.database).toBe('ok');
  expect(json.notificationsMode).toBe('simulation');
  expect(body).not.toMatch(/@|email|password|token/i);
});

test('navigation au clavier : signalement atteignable et focus visible (EXG-15)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-375', 'parcours au clavier sur mobile');
  await page.goto('/signaler');
  // Au clavier seulement : message de sécurité validé avec Entrée, puis choix du type.
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        text: el.textContent?.trim() ?? '',
        visible: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
      };
    });
    if (state) expect(state.visible, `focus visible sur « ${state.text} »`).toBe(true);
    if (state?.text.includes('compris')) await page.keyboard.press('Enter');
    if (state?.text.includes('Inondation')) reached = true;
  }
  expect(reached).toBe(true);
});

test('captures de la Phase 6', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'captures à 375 et 1280 px');
  test.setTimeout(90_000);
  const width = testInfo.project.name === 'mobile-375' ? 375 : 1280;
  const viewport = { width, height: width === 375 ? 812 : 800 };
  const shotOf = async (page: Page, name: string) => {
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `défilement horizontal sur ${name}`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `docs/screenshots/phase-6/${name}-${width}.png`,
      fullPage: true,
    });
  };

  const visitor = await browser.newContext({ baseURL, viewport });
  const home = await visitor.newPage();
  await home.goto('/');
  await expect(home.getByTestId('tutorial-prompt')).toBeVisible();
  await shotOf(home, 'accueil-tutoriel-flottant');
  await visitor.close();

  const admin = await browser.newContext({ baseURL, viewport });
  const page = await admin.newPage();
  await loginWithoutSecondFactor(page, ADMIN);
  await page.waitForURL(/\/connexion\/second-facteur/);
  await shotOf(page, 'second-facteur');
  await completeSecondFactor(page, ADMIN);
  await page.goto('/back-office/supervision');
  await shotOf(page, 'back-office-supervision');
  await admin.close();
});
