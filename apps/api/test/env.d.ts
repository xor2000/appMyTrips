import type { D1Migration } from '@cloudflare/vitest-plugin';
import type { Bindings } from '../src/env';

declare global {
  namespace Cloudflare {
    /** Bindings du Worker, plus les migrations injectées par vitest.config.ts. */
    interface Env extends Bindings {
      TEST_MIGRATIONS: D1Migration[];
    }
    /** Type de `exports` (cloudflare:workers) : le module principal du Worker. */
    interface GlobalProps {
      mainModule: typeof import('../src/index');
    }
  }
}
