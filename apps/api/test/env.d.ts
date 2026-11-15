import type { Bindings } from '../src/env';

declare global {
  namespace Cloudflare {
    // Augmentation de l'interface globale : elle doit rester une interface.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends Bindings {}
    /** Type de `exports` (cloudflare:workers) : le module principal du Worker. */
    interface GlobalProps {
      mainModule: typeof import('../src/index');
    }
  }
}
