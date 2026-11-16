import {
  LoginInput,
  PasswordChange,
  ResetInput,
  SignupInput,
  isAdminEmail,
  type Me,
} from '@mytrips/core';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { checkCaptcha, createCaptcha } from '../auth/captcha';
import { sha256Hex } from '../auth/crypto';
import {
  clearLoginFailures,
  emailLocked,
  isBanned,
  recordLoginFailure,
  recordSignup,
  signupLimitReached,
} from '../auth/limits';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../auth/password';
import { clientIp, closeSession, openSession, type AuthEnv } from '../auth/session';
import { now, parseBody } from './shared';

export function me(c: Context<AuthEnv>, email = c.get('userEmail')): Me {
  return { email, isAdmin: isAdminEmail(email, c.env.ADMIN_EMAILS) };
}

/** Refuse les IP bannies (connexion, inscription, réinitialisation). */
const notBanned: MiddlewareHandler<AuthEnv> = async (c, next) => {
  if (await isBanned(c.env.DB, clientIp(c))) return c.json({ error: 'ip_banned' }, 403);
  await next();
};

const tooMany = (c: Context) => c.json({ error: 'too_many_attempts' }, 429);

/** Routes publiques : captcha, inscription, connexion, déconnexion, réinitialisation. */
export const publicAuthRoutes = new Hono<AuthEnv>();

publicAuthRoutes.get('/captcha', notBanned, async (c) => {
  if (!c.env.AUTH_SECRET) return c.json({ error: 'auth_not_configured' }, 500);
  return c.json(await createCaptcha(c.env.AUTH_SECRET));
});

publicAuthRoutes.post('/signup', notBanned, async (c) => {
  if (!c.env.AUTH_SECRET) return c.json({ error: 'auth_not_configured' }, 500);
  const db = c.env.DB;
  const ip = clientIp(c);
  if (await signupLimitReached(db, ip)) return tooMany(c);
  const body = await parseBody(c, SignupInput);
  if ('error' in body) return body.error;
  const { email, password, captcha } = body.data;
  if (!(await checkCaptcha(db, c.env.AUTH_SECRET, captcha.token, captcha.answer))) {
    return c.json({ error: 'invalid_captcha' }, 400);
  }
  const hash = await hashPassword(password);
  const ts = now();
  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (email) DO NOTHING`,
      )
      .bind(email, hash, ts, ts),
    recordSignup(db, ip, email),
  ]);
  if ((inserted?.meta.changes ?? 0) !== 1) return c.json({ error: 'email_taken' }, 409);
  await openSession(c, email);
  return c.json(me(c, email), 201);
});

publicAuthRoutes.post('/login', notBanned, async (c) => {
  const db = c.env.DB;
  const ip = clientIp(c);
  const body = await parseBody(c, LoginInput);
  if ('error' in body) return body.error;
  const { email, password } = body.data;
  if (await emailLocked(db, email)) return tooMany(c);
  const user = await db
    .prepare('SELECT password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ password_hash: string }>();
  // Compte inconnu : même calcul et même réponse qu'un mauvais mot de passe.
  const result = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !result.ok) {
    await recordLoginFailure(db, ip, email);
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  await clearLoginFailures(db, ip, email);
  if (result.needsRehash) {
    await db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?')
      .bind(await hashPassword(password), now(), email)
      .run();
  }
  await openSession(c, email);
  return c.json(me(c, email));
});

publicAuthRoutes.post('/logout', async (c) => {
  await closeSession(c);
  return c.body(null, 204);
});

publicAuthRoutes.post('/reset/:token', notBanned, async (c) => {
  const db = c.env.DB;
  const body = await parseBody(c, ResetInput);
  if ('error' in body) return body.error;
  const tokenHash = await sha256Hex(c.req.param('token'));
  const ts = now();
  const reset = await db
    .prepare(
      'SELECT email FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
    )
    .bind(tokenHash, ts)
    .first<{ email: string }>();
  if (!reset) return c.json({ error: 'invalid_link' }, 404);
  const hash = await hashPassword(body.data.password);
  const [used] = await db.batch([
    db
      .prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL')
      .bind(ts, tokenHash),
    db
      .prepare(
        `UPDATE users SET password_hash = ?, updated_at = ?
         WHERE email = ? AND (SELECT used_at FROM password_resets WHERE token_hash = ?) = ?`,
      )
      .bind(hash, ts, reset.email, tokenHash, ts),
    // Toutes les sessions du compte sont fermées.
    db
      .prepare(
        `DELETE FROM sessions
         WHERE email = ? AND (SELECT used_at FROM password_resets WHERE token_hash = ?) = ?`,
      )
      .bind(reset.email, tokenHash, ts),
  ]);
  if ((used?.meta.changes ?? 0) !== 1) return c.json({ error: 'invalid_link' }, 404);
  return c.body(null, 204);
});

/** Routes qui exigent une session : changement de mot de passe. */
export const privateAuthRoutes = new Hono<AuthEnv>();

privateAuthRoutes.post('/password', async (c) => {
  const db = c.env.DB;
  const email = c.get('userEmail');
  const body = await parseBody(c, PasswordChange);
  if ('error' in body) return body.error;
  const user = await db
    .prepare('SELECT password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ password_hash: string }>();
  if (!user || !(await verifyPassword(body.data.current, user.password_hash)).ok) {
    // 400 et non 401 : le front renvoie tout 401 vers la page de connexion.
    return c.json({ error: 'wrong_password' }, 400);
  }
  const hash = await hashPassword(body.data.next);
  await db.batch([
    db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?')
      .bind(hash, now(), email),
    // Les autres sessions sont fermées ; celle-ci reste ouverte.
    db
      .prepare('DELETE FROM sessions WHERE email = ? AND token_hash != ?')
      .bind(email, c.get('sessionHash') ?? ''),
  ]);
  return c.body(null, 204);
});
