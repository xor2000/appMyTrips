import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createCaptcha } from '../src/auth/captcha';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../src/auth/password';
import { freshEmail, freshIp, raw, signup, solve } from './auth-helpers';

describe('mots de passe', () => {
  it('empreinte PBKDF2-SHA256 versionnée, sel différent à chaque fois', async () => {
    const a = await hashPassword('mot-de-passe-1');
    const b = await hashPassword('mot-de-passe-1');
    expect(a).toMatch(/^pbkdf2-sha256\$\d+\$[\w-]+\$[\w-]+$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword('mot-de-passe-1', a)).toMatchObject({ ok: true });
    expect(await verifyPassword('autre-mot-de-passe', a)).toMatchObject({ ok: false });
  });

  it('empreinte d’un format inconnu ou d’un nombre de répétitions plus faible : à renforcer', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toEqual({ ok: false, needsRehash: false });
    const weak = await hashPassword('mot-de-passe-1', 1000);
    expect(await verifyPassword('mot-de-passe-1', weak)).toEqual({ ok: true, needsRehash: true });
  });

  it('empreinte factice (compte inconnu) : format valide, aucun mot de passe ne correspond', async () => {
    expect(DUMMY_HASH).toMatch(/^pbkdf2-sha256\$5000\$[\w-]{22}\$[\w-]{43}$/);
    expect(await verifyPassword('mot-de-passe-1', DUMMY_HASH)).toEqual({
      ok: false,
      needsRehash: false,
    });
  });
});

describe('captcha', () => {
  it('pose une question de calcul et un jeton signé', async () => {
    const res = await raw('GET', '/api/auth/captcha');
    expect(res.status).toBe(200);
    expect(res.body.question).toMatch(/^Combien font \d+ \+ \d+ \?$/);
    expect(res.body.token).toEqual(expect.any(String));
  });
});

describe('inscription', () => {
  async function attempt(overrides: Record<string, unknown> = {}, ip = freshIp()) {
    const captcha = await raw('GET', '/api/auth/captcha', { ip });
    return raw('POST', '/api/auth/signup', {
      ip,
      body: {
        email: freshEmail(),
        password: 'mot-de-passe-1',
        captcha: { token: captcha.body.token, answer: solve(captcha.body.question) },
        ...overrides,
      },
    });
  }

  it('crée le compte et ouvre une session (cookie sécurisé)', async () => {
    const res = await attempt();
    expect(res.status).toBe(201);
    expect(res.session).toEqual(expect.any(String));
    expect(res.setCookie).toMatch(/HttpOnly/);
    expect(res.setCookie).toMatch(/Secure/);
    expect(res.setCookie).toMatch(/SameSite=Lax/);
    expect(res.setCookie).toMatch(/Path=\//);
    const me = await raw('GET', '/api/me', { session: res.session! });
    expect(me.body).toEqual({ email: expect.stringMatching(/@example\.test$/), isAdmin: false });
  });

  it('e-mail déjà pris : 409', async () => {
    const { email } = await signup();
    const res = await attempt({ email });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('captcha absent, faux, réutilisé ou signé par un autre secret : 400 invalid_captcha', async () => {
    expect((await attempt({ captcha: undefined })).status).toBe(400);
    const ip = freshIp();
    const captcha = await raw('GET', '/api/auth/captcha', { ip });
    const wrong = await raw('POST', '/api/auth/signup', {
      ip,
      body: {
        email: freshEmail(),
        password: 'mot-de-passe-1',
        captcha: { token: captcha.body.token, answer: '9999' },
      },
    });
    expect(wrong.body.error).toBe('invalid_captcha');
    // Un jeton déjà présenté ne sert plus, même avec la bonne réponse.
    const reused = await raw('POST', '/api/auth/signup', {
      ip,
      body: {
        email: freshEmail(),
        password: 'mot-de-passe-1',
        captcha: { token: captcha.body.token, answer: solve(captcha.body.question) },
      },
    });
    expect(reused.body.error).toBe('invalid_captcha');
    const other = await raw('GET', '/api/auth/captcha', {
      ip,
      bindings: { AUTH_SECRET: 'un-autre-secret' },
    });
    const forged = await raw('POST', '/api/auth/signup', {
      ip,
      body: {
        email: freshEmail(),
        password: 'mot-de-passe-1',
        captcha: { token: other.body.token, answer: solve(other.body.question) },
      },
    });
    expect(forged.body.error).toBe('invalid_captcha');
  });

  it('captcha expiré (plus de 10 minutes) : refusé', async () => {
    const captcha = await createCaptcha(env.AUTH_SECRET!, Date.now() - 11 * 60 * 1000);
    const res = await raw('POST', '/api/auth/signup', {
      ip: freshIp(),
      body: {
        email: freshEmail(),
        password: 'mot-de-passe-1',
        captcha: { token: captcha.token, answer: solve(captcha.question) },
      },
    });
    expect(res.body.error).toBe('invalid_captcha');
  });

  it('mot de passe trop court : 400', async () => {
    const res = await attempt({ password: 'court' });
    expect(res.status).toBe(400);
  });

  it('5 inscriptions par IP et par heure, puis 429', async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) expect((await attempt({}, ip)).status).toBe(201);
    const res = await attempt({}, ip);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_attempts');
  });
});

describe('connexion', () => {
  it('bon mot de passe : session ouverte', async () => {
    const user = await signup();
    const res = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: user.email.toUpperCase(), password: user.password },
    });
    expect(res.status).toBe(200);
    expect(res.session).toEqual(expect.any(String));
    expect(res.body).toEqual({ email: user.email, isAdmin: false });
  });

  it('mauvais mot de passe et compte inconnu : même réponse', async () => {
    const user = await signup();
    const wrong = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: user.email, password: 'faux-mot-de-passe' },
    });
    const unknown = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: freshEmail('inconnu'), password: 'faux-mot-de-passe' },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error).toBe('invalid_credentials');
  });

  it('3 mots de passe faux depuis une IP : IP bannie (403), même avec le bon mot de passe', async () => {
    const user = await signup();
    const ip = freshIp();
    for (let i = 0; i < 3; i++) {
      await raw('POST', '/api/auth/login', { ip, body: { email: user.email, password: 'faux-1' } });
    }
    const res = await raw('POST', '/api/auth/login', {
      ip,
      body: { email: user.email, password: user.password },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ip_banned');
    // Inscription et réinitialisation aussi refusées depuis cette IP.
    expect((await raw('GET', '/api/auth/captcha', { ip })).status).toBe(403);
    expect(
      (
        await raw('POST', '/api/auth/reset/jeton-inconnu', {
          ip,
          body: { password: 'nouveau-mot-1' },
        })
      ).status,
    ).toBe(403);
    // Une autre IP n'est pas concernée.
    const other = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: user.email, password: user.password },
    });
    expect(other.status).toBe(200);
  });

  it('une connexion réussie remet le compteur de l’IP à zéro', async () => {
    const user = await signup();
    const ip = freshIp();
    const fail = () =>
      raw('POST', '/api/auth/login', { ip, body: { email: user.email, password: 'faux-1' } });
    await fail();
    await fail();
    await raw('POST', '/api/auth/login', {
      ip,
      body: { email: user.email, password: user.password },
    });
    await fail();
    await fail();
    const res = await raw('POST', '/api/auth/login', {
      ip,
      body: { email: user.email, password: user.password },
    });
    expect(res.status).toBe(200);
  });

  it('5 échecs sur un même e-mail depuis plusieurs IP : 429', async () => {
    const user = await signup();
    for (let i = 0; i < 5; i++) {
      await raw('POST', '/api/auth/login', {
        ip: freshIp(),
        body: { email: user.email, password: 'faux-1' },
      });
    }
    const res = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: user.email, password: user.password },
    });
    expect(res.status).toBe(429);
  });
});

describe('sessions', () => {
  it('sans session : 401 ; /api/health reste public', async () => {
    expect((await raw('GET', '/api/me')).status).toBe(401);
    expect((await raw('GET', '/api/trips')).status).toBe(401);
    expect((await raw('GET', '/api/health')).status).toBe(200);
  });

  it('session inconnue ou expirée : 401', async () => {
    expect((await raw('GET', '/api/me', { session: 'jeton-inconnu' })).status).toBe(401);
    const user = await signup();
    await env.DB.prepare(
      "UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE email = ?",
    )
      .bind(user.email)
      .run();
    expect((await raw('GET', '/api/me', { session: user.session })).status).toBe(401);
  });

  it('déconnexion : session supprimée, cookie effacé', async () => {
    const user = await signup();
    const res = await raw('POST', '/api/auth/logout', { session: user.session });
    expect(res.status).toBe(204);
    expect(res.session).toBeNull();
    expect((await raw('GET', '/api/me', { session: user.session })).status).toBe(401);
  });

  it('changer de mot de passe ferme les autres sessions', async () => {
    const user = await signup();
    const other = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: user.email, password: user.password },
    });
    const wrong = await raw('POST', '/api/auth/password', {
      session: user.session,
      body: { current: 'faux', next: 'nouveau-mot-1' },
    });
    // 400 et non 401 : le front renvoie tout 401 vers la page de connexion.
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('wrong_password');
    const res = await raw('POST', '/api/auth/password', {
      session: user.session,
      body: { current: user.password, next: 'nouveau-mot-1' },
    });
    expect(res.status).toBe(204);
    expect((await raw('GET', '/api/me', { session: user.session })).status).toBe(200);
    expect((await raw('GET', '/api/me', { session: other.session! })).status).toBe(401);
    const login = await raw('POST', '/api/auth/login', {
      ip: freshIp(),
      body: { email: user.email, password: 'nouveau-mot-1' },
    });
    expect(login.status).toBe(200);
  });
});

describe('protection CSRF', () => {
  it('écriture sans en-tête Origin ou d’une origine étrangère : 403', async () => {
    const user = await signup();
    const body = { name: 'Voyage', startDate: '2026-07-10', endDate: '2026-07-12' };
    const missing = await raw('POST', '/api/trips', { session: user.session, origin: null, body });
    const foreign = await raw('POST', '/api/trips', {
      session: user.session,
      origin: 'https://pirate.example',
      body,
    });
    expect(missing.status).toBe(403);
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toBe('bad_origin');
    const ok = await raw('POST', '/api/trips', { session: user.session, body });
    expect(ok.status).toBe(201);
  });

  it('lecture (GET) sans Origin : autorisée', async () => {
    const user = await signup();
    expect((await raw('GET', '/api/trips', { session: user.session, origin: null })).status).toBe(
      200,
    );
  });
});
