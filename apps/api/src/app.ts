import { Hono, type MiddlewareHandler } from 'hono';
import { sameOrigin, sessionAuth, type AuthEnv } from './auth/session';
import { adminRoutes } from './routes/admin';
import { me, privateAuthRoutes, publicAuthRoutes } from './routes/auth';
import { geocodeRoutes } from './routes/geocode';
import { invitationRoutes } from './routes/invitations';
import { legRoutes, routeRoutes } from './routes/legs';
import { poiRoutes } from './routes/poi';
import { trips } from './routes/trips';

/**
 * Application Hono de l'API. `auth` permet aux tests d'injecter une identité (en production :
 * session par cookie) ; `fetch` remplace le fetch des appels aux services externes.
 */
export function createApp(
  options: { auth?: MiddlewareHandler<AuthEnv>; fetch?: typeof fetch } = {},
) {
  const app = new Hono<AuthEnv>().basePath('/api');

  // Protection CSRF : toute écriture doit venir de la même origine.
  app.use('*', sameOrigin());

  // Routes publiques : sonde de disponibilité, captcha, inscription, connexion, déconnexion,
  // réinitialisation du mot de passe.
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/auth', publicAuthRoutes);

  // Toutes les autres routes /api/* exigent une session.
  app.use('*', options.auth ?? sessionAuth());

  app.get('/me', (c) => c.json(me(c)));
  app.route('/auth', privateAuthRoutes);
  app.route('/admin', adminRoutes);
  app.route('/invitations', invitationRoutes);
  app.route('/trips', trips);
  const outbound = options.fetch ?? ((input, init) => fetch(input, init));
  app.route('/geocode', geocodeRoutes(outbound));
  app.route('/poi', poiRoutes(outbound));
  app.route('/trips', legRoutes(outbound));
  app.route('/route', routeRoutes(outbound));

  return app;
}
