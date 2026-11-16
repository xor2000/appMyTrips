import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;
const MOCK_PORT = 8798;

// Les e2e tournent sur le build de production servi par le Worker (wrangler dev),
// pour que le service worker et le fallback SPA se comportent comme en production.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Photon et Overpass factices : ils sont appelés par le Worker, pas par le navigateur.
      command: `node e2e/mock-services.mjs`,
      url: `http://localhost:${MOCK_PORT}/health`,
      env: { MOCK_SERVICES_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      // Base D1 locale dédiée aux e2e (.wrangler/e2e), migrée avant le démarrage.
      command: [
        'pnpm build',
        'pnpm --filter @mytrips/api exec wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e',
        `pnpm --filter @mytrips/api exec wrangler dev --port ${PORT} --persist-to .wrangler/e2e --var DEV_USER_EMAIL:dev@example.test --var PHOTON_URL:http://localhost:${MOCK_PORT} --var OVERPASS_URLS:http://localhost:${MOCK_PORT}/overpass/api/interpreter`,
      ].join(' && '),
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
