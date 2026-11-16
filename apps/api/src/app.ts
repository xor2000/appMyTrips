import { Hono, type MiddlewareHandler } from 'hono';
import { accessAuth, type AuthEnv } from './auth';
import { geocodeRoutes } from './routes/geocode';
import { poiRoutes } from './routes/poi';
import { trips } from './routes/trips';

/**
 * Application Hono de l'API. `auth` permet aux tests d'injecter une identité (en production :
 * Cloudflare Access) ; `fetch` remplace le fetch des appels aux services externes.
 */
export function createApp(
  options: { auth?: MiddlewareHandler<AuthEnv>; fetch?: typeof fetch } = {},
) {
  const app = new Hono<AuthEnv>().basePath('/api');

  // Route publique : sonde de disponibilité.
  app.get('/health', (c) => c.json({ ok: true }));

  // Toutes les autres routes /api/* exigent une identité.
  app.use('*', options.auth ?? accessAuth());

  app.get('/me', (c) => c.json({ email: c.get('userEmail') }));
  app.route('/trips', trips);
  const outbound = options.fetch ?? ((input, init) => fetch(input, init));
  app.route('/geocode', geocodeRoutes(outbound));
  app.route('/poi', poiRoutes(outbound));

  return app;
}
