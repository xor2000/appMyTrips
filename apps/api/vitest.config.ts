import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          AUTH_SECRET: 'secret-de-test',
          ADMIN_EMAILS: 'admin@example.test',
          // Migrations D1 appliquées par test/apply-migrations.ts avant chaque fichier de test.
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
    // Le premier appel au Worker (démarrage de workerd) peut dépasser 5 s sur une machine chargée.
    testTimeout: 20_000,
  },
});
