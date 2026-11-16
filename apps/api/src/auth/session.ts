import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Bindings } from '../env';
import { randomToken, sha256Hex } from './crypto';

export type AuthEnv = {
  Bindings: Bindings;
  Variables: { userEmail: string; sessionHash?: string };
};

/** Cookie de session : préfixe __Host- (Secure, Path=/, sans Domain : lié à l'origine exacte). */
export const SESSION_COOKIE = '__Host-session';
/** Durée d'une session, prolongée à l'usage (30 jours glissants). */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** La prolongation n'est écrite qu'une fois par jour au plus, pour limiter les écritures D1. */
const TOUCH_EVERY_MS = 24 * 60 * 60 * 1000;

/** Ouvre une session pour `email` : ligne en base et cookie. */
export async function openSession(c: Context, email: string): Promise<void> {
  const token = randomToken();
  const now = Date.now();
  await (c.env as Bindings).DB.prepare(
    `INSERT INTO sessions (token_hash, email, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      await sha256Hex(token),
      email,
      new Date(now).toISOString(),
      new Date(now).toISOString(),
      new Date(now + SESSION_TTL_MS).toISOString(),
    )
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Ferme la session du cookie (si elle existe) et efface le cookie. */
export async function closeSession(c: Context): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await (c.env as Bindings).DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token))
      .run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
}

/**
 * Authentifie la requête par le cookie de session et expose l'e-mail dans `c.get('userEmail')`.
 * Sans session valide : 401.
 */
export function sessionAuth(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token || token.length > 100) return c.json({ error: 'unauthorized' }, 401);
    const hash = await sha256Hex(token);
    const db = c.env.DB;
    const row = await db
      .prepare('SELECT email, last_seen_at, expires_at FROM sessions WHERE token_hash = ?')
      .bind(hash)
      .first<{ email: string; last_seen_at: string; expires_at: string }>();
    const now = Date.now();
    if (!row || Date.parse(row.expires_at) <= now) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    if (now - Date.parse(row.last_seen_at) > TOUCH_EVERY_MS) {
      await db
        .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?')
        .bind(new Date(now).toISOString(), new Date(now + SESSION_TTL_MS).toISOString(), hash)
        .run();
      setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
      });
    }
    c.set('userEmail', row.email);
    c.set('sessionHash', hash);
    await next();
  };
}

/**
 * Protection CSRF : toute requête qui modifie des données doit venir de la même origine (en-tête
 * Origin égal à l'hôte de la requête). Complète SameSite=Lax.
 */
export function sameOrigin(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const method = c.req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
    const origin = c.req.header('origin');
    const host = c.req.header('host') ?? new URL(c.req.url).host;
    let originHost: string | null;
    try {
      originHost = origin ? new URL(origin).host : null;
    } catch {
      originHost = null;
    }
    if (!originHost || originHost !== host) return c.json({ error: 'bad_origin' }, 403);
    await next();
  };
}

/** Adresse IP du client (posée par Cloudflare). */
export function clientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') ?? 'inconnue';
}
