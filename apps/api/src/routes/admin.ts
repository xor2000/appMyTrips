import { Email, isAdminEmail } from '@mytrips/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { randomToken, sha256Hex } from '../auth/crypto';
import { listBans, unban } from '../auth/limits';
import type { AuthEnv } from '../auth/session';
import { now, parseBody } from './shared';

/** Durée de validité d'un lien de réinitialisation. */
export const RESET_TTL_MS = 24 * 60 * 60 * 1000;

/** /api/admin : réservé aux e-mails de ADMIN_EMAILS. */
export const adminRoutes = new Hono<AuthEnv>();

adminRoutes.use('*', async (c, next) => {
  if (!isAdminEmail(c.get('userEmail'), c.env.ADMIN_EMAILS)) {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
});

adminRoutes.post('/resets', async (c) => {
  const body = await parseBody(c, z.object({ email: Email }));
  if ('error' in body) return body.error;
  const { email } = body.data;
  const db = c.env.DB;
  const user = await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (!user) return c.json({ error: 'unknown_user' }, 404);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  await db
    .prepare(
      `INSERT INTO password_resets (token_hash, email, created_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(await sha256Hex(token), email, c.get('userEmail'), now(), expiresAt)
    .run();
  return c.json({ token, expiresAt }, 201);
});

adminRoutes.get('/bans', async (c) => {
  return c.json({ bans: await listBans(c.env.DB) });
});

adminRoutes.delete('/bans/:ip', async (c) => {
  // c.req.param() renvoie la valeur déjà décodée.
  await unban(c.env.DB, c.req.param('ip'));
  return c.body(null, 204);
});
