import { Email } from '@mytrips/core';
import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Bindings } from './env';

export type AuthEnv = {
  Bindings: Bindings;
  Variables: { userEmail: string };
};

type KeyResolver = (teamDomain: string) => JWTVerifyGetKey;

const remoteKeySets = new Map<string, JWTVerifyGetKey>();

/** JWKS Access de l'équipe, mis en cache par isolat (jose gère aussi le cache des clés). */
const remoteKeys: KeyResolver = (teamDomain) => {
  let keys = remoteKeySets.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    remoteKeySets.set(teamDomain, keys);
  }
  return keys;
};

/**
 * Authentifie la requête par le JWT Cloudflare Access (en-tête Cf-Access-Jwt-Assertion)
 * et expose l'e-mail normalisé dans `c.get('userEmail')`.
 *
 * En développement local, si ACCESS_AUD n'est pas défini, DEV_USER_EMAIL remplace le JWT.
 */
export function accessAuth(options: { getKey?: KeyResolver } = {}): MiddlewareHandler<AuthEnv> {
  const getKey = options.getKey ?? remoteKeys;

  return async (c, next) => {
    const { ACCESS_TEAM_DOMAIN, ACCESS_AUD, DEV_USER_EMAIL } = c.env;

    if (!ACCESS_AUD && DEV_USER_EMAIL) {
      // Mode dev : l'en-tête x-dev-user-email permet de jouer plusieurs utilisateurs (e2e).
      const override = Email.safeParse(c.req.header('x-dev-user-email'));
      const dev = override.success ? override : Email.safeParse(DEV_USER_EMAIL);
      if (dev.success) {
        c.set('userEmail', dev.data);
        return next();
      }
    }

    if (!ACCESS_AUD || !ACCESS_TEAM_DOMAIN) {
      return c.json({ error: 'access_not_configured' }, 500);
    }

    const token = c.req.header('Cf-Access-Jwt-Assertion');
    if (!token) return c.json({ error: 'unauthorized' }, 401);

    try {
      const { payload } = await jwtVerify(token, getKey(ACCESS_TEAM_DOMAIN), {
        issuer: `https://${ACCESS_TEAM_DOMAIN}`,
        audience: ACCESS_AUD,
        // Cloudflare Access signe ses jetons en RS256 : tout autre algorithme est refusé.
        algorithms: ['RS256'],
      });
      const email = Email.safeParse(payload.email);
      if (!email.success) return c.json({ error: 'unauthorized' }, 401);
      c.set('userEmail', email.data);
    } catch {
      return c.json({ error: 'unauthorized' }, 401);
    }

    return next();
  };
}
