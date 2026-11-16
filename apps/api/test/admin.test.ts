import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { resetLinkSql, unbanIpSql } from '../scripts/sql.mjs';
import { freshIp, raw, signup } from './auth-helpers';

/** Administrateur de test : e-mail de ADMIN_EMAILS (vitest.config.ts), compte créé une fois. */
const ADMIN = 'admin@example.test';
let adminSession: Promise<string> | undefined;
function admin(): Promise<string> {
  adminSession ??= (async () => {
    const existing = await env.DB.prepare('SELECT 1 FROM users WHERE email = ?')
      .bind(ADMIN)
      .first();
    if (!existing) return (await signup(ADMIN)).session;
    const login = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: ADMIN, password: 'mot-de-passe-1' },
    });
    return login.session!;
  })();
  return adminSession;
}

async function banIp(email: string) {
  const ip = freshIp();
  for (let i = 0; i < 3; i++) {
    await raw('POST', '/api/auth/login', { ip, body: { email, password: 'faux-1' } });
  }
  return ip;
}

describe('administration', () => {
  it('/api/me indique l’administrateur', async () => {
    const me = await raw('GET', '/api/me', { session: await admin() });
    expect(me.body).toEqual({ email: ADMIN, isAdmin: true });
  });

  it('routes /api/admin réservées aux administrateurs (403)', async () => {
    const user = await signup();
    expect((await raw('GET', '/api/admin/bans', { session: user.session })).status).toBe(403);
    expect(
      (
        await raw('POST', '/api/admin/resets', {
          session: user.session,
          body: { email: user.email },
        })
      ).status,
    ).toBe(403);
    expect((await raw('GET', '/api/admin/bans')).status).toBe(401);
  });

  it('liste les IP bannies (date, e-mail tenté, échecs) et les réactive', async () => {
    const user = await signup();
    const ip = await banIp(user.email);
    const session = await admin();
    const list = await raw('GET', '/api/admin/bans', { session });
    expect(list.status).toBe(200);
    expect(list.body.bans).toContainEqual({
      ip,
      bannedAt: expect.any(String),
      lastEmail: user.email,
      failures: 3,
    });
    const lifted = await raw('DELETE', `/api/admin/bans/${encodeURIComponent(ip)}`, { session });
    expect(lifted.status).toBe(204);
    const login = await raw('POST', '/api/auth/login', {
      ip,
      body: { email: user.email, password: user.password },
    });
    expect(login.status).toBe(200);
  });

  it('réactivée, l’IP repart d’un compteur vide', async () => {
    const user = await signup();
    const ip = await banIp(user.email);
    await raw('DELETE', `/api/admin/bans/${encodeURIComponent(ip)}`, { session: await admin() });
    await raw('POST', '/api/auth/login', { ip, body: { email: user.email, password: 'faux-1' } });
    const login = await raw('POST', '/api/auth/login', {
      ip,
      body: { email: user.email, password: user.password },
    });
    expect(login.status).toBe(200);
  });
});

describe('réinitialisation du mot de passe', () => {
  it('lien généré par l’admin (24 h, usage unique) : nouveau mot de passe, sessions fermées', async () => {
    const user = await signup();
    const created = await raw('POST', '/api/admin/resets', {
      session: await admin(),
      body: { email: user.email.toUpperCase() },
    });
    expect(created.status).toBe(201);
    const hours = (Date.parse(created.body.expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);

    const reset = await raw('POST', `/api/auth/reset/${created.body.token}`, {
      ip: freshIp(),
      body: { password: 'nouveau-mot-1' },
    });
    expect(reset.status).toBe(204);
    expect((await raw('GET', '/api/me', { session: user.session })).status).toBe(401);
    const login = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: user.email, password: 'nouveau-mot-1' },
    });
    expect(login.status).toBe(200);

    const again = await raw('POST', `/api/auth/reset/${created.body.token}`, {
      ip: freshIp(),
      body: { password: 'encore-autre-1' },
    });
    expect(again.status).toBe(404);
    expect(again.body.error).toBe('invalid_link');
  });

  it('compte inconnu : 404 ; mot de passe trop court : 400 ; lien expiré : 404', async () => {
    const session = await admin();
    expect(
      (
        await raw('POST', '/api/admin/resets', {
          session,
          body: { email: 'personne@example.test' },
        })
      ).status,
    ).toBe(404);
    const user = await signup();
    const created = await raw('POST', '/api/admin/resets', {
      session,
      body: { email: user.email },
    });
    expect(
      (
        await raw('POST', `/api/auth/reset/${created.body.token}`, {
          ip: freshIp(),
          body: { password: 'court' },
        })
      ).status,
    ).toBe(400);
    await env.DB.prepare(
      "UPDATE password_resets SET expires_at = '2000-01-01T00:00:00.000Z' WHERE email = ?",
    )
      .bind(user.email)
      .run();
    expect(
      (
        await raw('POST', `/api/auth/reset/${created.body.token}`, {
          ip: freshIp(),
          body: { password: 'nouveau-mot-1' },
        })
      ).status,
    ).toBe(404);
  });
});

describe('commandes de secours (SQL des scripts)', () => {
  it('reset-link : le lien produit par le SQL fonctionne', async () => {
    const user = await signup();
    const token = 'jeton-de-secours-' + crypto.randomUUID();
    await env.DB.exec(await resetLinkSql(user.email, token, new Date()));
    const reset = await raw('POST', `/api/auth/reset/${token}`, {
      ip: freshIp(),
      body: { password: 'nouveau-mot-1' },
    });
    expect(reset.status).toBe(204);
  });

  it('unban-ip : l’IP est réactivée et son compteur vidé', async () => {
    const user = await signup();
    const ip = await banIp(user.email);
    await env.DB.exec(unbanIpSql(ip));
    const login = await raw('POST', '/api/auth/login', {
      ip,
      body: { email: user.email, password: user.password },
    });
    expect(login.status).toBe(200);
  });

  it('refuse un e-mail ou une IP qui ne sont pas valides (pas d’injection SQL)', async () => {
    await expect(resetLinkSql("x'; DROP TABLE users; --", 't', new Date())).rejects.toThrow();
    expect(() => unbanIpSql("1.2.3.4'; DROP TABLE ip_bans; --")).toThrow();
  });
});
