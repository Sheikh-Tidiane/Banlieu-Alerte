import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
// Navigateur : Chrome installé sur le poste par défaut (pas de téléchargement) ;
// E2E_BROWSER_CHANNEL=chromium pour le Chromium de Playwright (CI, Docker).
const channel = process.env.E2E_BROWSER_CHANNEL ?? 'chrome';

// Tests de parcours sur le build de production. Tailles d'écran du CDC §12.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // 2 processus : au-delà, le poste de développement sature (serveur, Chrome, 3G simulée,
  // Docker) et les temps de réponse mesurés ne veulent plus rien dire.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL, channel, trace: 'retain-on-failure', locale: 'fr-FR' },
  projects: [
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // Les tests créent plusieurs signalements depuis la même adresse : limites relevées.
    env: { ...(process.env as Record<string, string>), RATE_LIMIT_FACTOR: '100' },
  },
});
