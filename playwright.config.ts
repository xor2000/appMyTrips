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
  projects: [
    {
      name: 'chromium',
      // 900 px de haut : un glisser-déposer ne doit pas faire défiler le panneau (Chromium perd
      // alors le dépôt quand Playwright fait défiler jusqu'à la cible pendant le glisser).
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: [
    {
      // Services externes factices (Photon, Overpass, ORS, Transitous) : ils sont appelés par le
      // Worker, pas par le navigateur.
      command: `node e2e/mock-services.mjs`,
      url: `http://localhost:${MOCK_PORT}/health`,
      env: { MOCK_SERVICES_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      // Base D1 locale dédiée aux e2e (.wrangler/e2e), migrée avant le démarrage.
      command: [
        'pnpm build',
        // Base repartie de zéro à chaque exécution : accumulée, la liste des voyages ralentit au
        // point de dépasser les délais d'attente des tests.
        `node -e "require('node:fs').rmSync('apps/api/.wrangler/e2e', { recursive: true, force: true })"`,
        'pnpm --filter @mytrips/api exec wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e',
        `pnpm --filter @mytrips/api exec wrangler dev --port ${PORT} --persist-to .wrangler/e2e --var DEV_USER_EMAIL:dev@example.test --var PHOTON_URL:http://localhost:${MOCK_PORT} --var OVERPASS_URLS:http://localhost:${MOCK_PORT}/overpass/api/interpreter --var ORS_URL:http://localhost:${MOCK_PORT}/ors --var ORS_API_KEY:cle-e2e --var TRANSITOUS_URL:http://localhost:${MOCK_PORT}/transitous`,
      ].join(' && '),
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
