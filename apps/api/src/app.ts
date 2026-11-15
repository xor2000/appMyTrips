import { Hono, type MiddlewareHandler } from 'hono';
import { accessAuth, type AuthEnv } from './auth';
import { trips } from './routes/trips';

/**
 * Application Hono de l'API. `auth` permet aux tests d'injecter une identité ; en production,
 * c'est le middleware Cloudflare Access.
 */
export function createApp(options: { auth?: MiddlewareHandler<AuthEnv> } = {}) {
  const app = new Hono<AuthEnv>().basePath('/api');

  // Route publique : sonde de disponibilité.
  app.get('/health', (c) => c.json({ ok: true }));

  // Toutes les autres routes /api/* exigent une identité.
  app.use('*', options.auth ?? accessAuth());

  app.get('/me', (c) => c.json({ email: c.get('userEmail') }));
  app.route('/trips', trips);

  return app;
}
