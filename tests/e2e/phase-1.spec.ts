import { expect, test } from '@playwright/test';

const pages = [
  { path: '/', name: 'accueil', heading: 'Banlieue Alerte' },
  { path: '/brand', name: 'brand', heading: 'Identité visuelle' },
  { path: '/design', name: 'design', heading: 'Design system' },
] as const;

for (const page of pages) {
  test(`${page.path} s'affiche sans défilement horizontal`, async ({ page: browser }, testInfo) => {
    await browser.goto(page.path);
    await expect(browser.getByRole('heading', { level: 1, name: page.heading })).toBeVisible();

    const overflow = await browser.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Captures demandées à 375 et 1280 px (CDC §12). Les images différées
    // (loading="lazy") sont chargées avant la capture pleine page.
    // Captures validées de la Phase 1 : régénérées seulement sur demande (CAPTURE_PHASE=1).
    if (process.env.CAPTURE_PHASE === '1' && testInfo.project.name !== 'tablet-768') {
      await browser.evaluate(async () => {
        const images = [...document.images];
        images.forEach((img) => (img.loading = 'eager'));
        await Promise.all(
          images.map((img) => (img.complete ? null : img.decode().catch(() => null))),
        );
      });
      await browser.screenshot({
        path: `docs/screenshots/phase-1/${page.name}-${testInfo.project.name.split('-')[1]}.png`,
        fullPage: true,
      });
    }
  });
}

test('/brand présente le logo retenu et toutes ses variantes', async ({ page }) => {
  await page.goto('/brand');
  for (const file of [
    'logo-horizontal.svg',
    'logo-horizontal-dark.svg',
    'logo-vertical.svg',
    'logo-vertical-dark.svg',
    'symbol.svg',
    'symbol-dark.svg',
    'logo-horizontal-mono-black.svg',
    'logo-horizontal-mono-white.svg',
    'favicon-16.png',
    'favicon-32.png',
    'icon-192.png',
    'icon-512.png',
  ]) {
    expect(await page.locator(`img[src*="${file}"]`).count()).toBeGreaterThan(0);
  }
  await page.evaluate(async () => {
    const images = [...document.images];
    images.forEach((img) => (img.loading = 'eager'));
    await Promise.all(images.map((img) => img.decode().catch(() => null)));
  });
  const broken = await page.evaluate(
    () => [...document.images].filter((img) => img.naturalWidth === 0).length,
  );
  expect(broken).toBe(0);
});

test('le logo, le favicon et le manifeste sont déclarés (EXG-27, EXG-28)', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.locator('header img[alt="Banlieue Alerte"]:visible')).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][href*="/brand/favicon.svg"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test('captures du symbole à 16, 32, 192 et 512 px, fonds clair et sombre', async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280' || process.env.CAPTURE_PHASE !== '1',
    'captures de la Phase 1 : CAPTURE_PHASE=1',
  );
  const icons = [
    ['favicon-16.png', 16],
    ['favicon-32.png', 32],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ] as const;
  for (const [name, background] of [
    ['clair', '#F7F9F7'],
    ['sombre', '#14211A'],
  ] as const) {
    await page.setViewportSize({ width: 900, height: 560 });
    await page.setContent(
      `<body style="margin:0;background:${background};display:flex;align-items:flex-end;gap:24px;padding:24px">${icons
        .map(
          ([file, size]) => `<img src="${baseURL}/brand/${file}" width="${size}" height="${size}">`,
        )
        .join('')}</body>`,
    );
    await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
    await page.screenshot({ path: `docs/screenshots/phase-1/symbole-tailles-${name}.png` });
  }
});

test('les boutons du design system font au moins 48 px de haut', async ({ page }) => {
  await page.goto('/design');
  const heights = await page
    .locator('main button:visible')
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(48);
});

test('/design : toast et modale fonctionnent', async ({ page }) => {
  await page.goto('/design');
  await page.getByRole('button', { name: 'Afficher un toast' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Action enregistrée.' })).toBeVisible();

  await page.getByRole('button', { name: 'Ouvrir une modale' }).click();
  const dialog = page.getByRole('dialog', { name: 'Exemple de modale' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('/design : le champ signale une erreur de validation', async ({ page }) => {
  await page.goto('/design');
  const field = page.getByLabel('Description (facultatif)');
  await field.fill('x'.repeat(201));
  await page.getByRole('button', { name: 'Vérifier le champ' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'trop de caractères' })).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
});
