import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          ACCESS_TEAM_DOMAIN: 'mytrips.cloudflareaccess.com',
          ACCESS_AUD: 'aud-de-test',
        },
      },
    }),
  ],
  test: {
    // Le premier appel au Worker (démarrage de workerd) peut dépasser 5 s sur une machine chargée.
    testTimeout: 20_000,
  },
});
