import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;

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
  webServer: {
    // Base D1 locale dédiée aux e2e (.wrangler/e2e), migrée avant le démarrage.
    command: [
      'pnpm build',
      'pnpm --filter @mytrips/api exec wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e',
      `pnpm --filter @mytrips/api exec wrangler dev --port ${PORT} --persist-to .wrangler/e2e --var DEV_USER_EMAIL:dev@example.test`,
    ].join(' && '),
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
