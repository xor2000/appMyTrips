import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { accessAuth, type AuthEnv } from '../src/auth';

const TEAM = 'mytrips.cloudflareaccess.com';
const AUD = 'aud-de-test';

let goodKeys: JWTVerifyGetKey;
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let ecPrivateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  const other = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  const ec = await generateKeyPair('ES256', { extractable: true });
  ecPrivateKey = ec.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
  const ecJwk = { ...(await exportJWK(ec.publicKey)), kid: 'k2', alg: 'ES256' };
  goodKeys = createLocalJWKSet({ keys: [jwk, ecJwk] });
});

function sign(
  key: CryptoKey,
  claims: { email?: string; aud?: string; iss?: string; exp?: string } = {},
): Promise<string> {
  const jwt = new SignJWT(claims.email === undefined ? {} : { email: claims.email })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuedAt()
    .setIssuer(claims.iss ?? `https://${TEAM}`)
    .setAudience(claims.aud ?? AUD)
    .setExpirationTime(claims.exp ?? '5m');
  return jwt.sign(key);
}

function app(vars: Partial<AuthEnv['Bindings']>) {
  const a = new Hono<AuthEnv>();
  a.use('*', accessAuth({ getKey: () => goodKeys }));
  a.get('/me', (c) => c.json({ email: c.get('userEmail') }));
  // DEV_USER_EMAIL est neutralisé par défaut : un apps/api/.dev.vars local ne doit pas changer les tests.
  const bindings = {
    ...env,
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    DEV_USER_EMAIL: undefined,
    ...vars,
  };
  return (headers: Record<string, string> = {}) =>
    a.request('/me', { headers }, bindings as AuthEnv['Bindings']);
}

describe('middleware Cloudflare Access', () => {
  it('refuse une requête sans JWT (401)', async () => {
    const res = await app({})();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('accepte un JWT valide et expose l’e-mail en minuscules', async () => {
    const token = await sign(privateKey, { email: 'Alice@Example.test' });
    const res = await app({})({ 'Cf-Access-Jwt-Assertion': token });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'alice@example.test' });
  });

  it('refuse un JWT signé par une autre clé', async () => {
    const token = await sign(otherPrivateKey, { email: 'alice@example.test' });
    const res = await app({})({ 'Cf-Access-Jwt-Assertion': token });
    expect(res.status).toBe(401);
  });

  it('refuse un JWT avec une mauvaise audience', async () => {
    const token = await sign(privateKey, { email: 'alice@example.test', aud: 'autre' });
    const res = await app({})({ 'Cf-Access-Jwt-Assertion': token });
    expect(res.status).toBe(401);
  });

  it('refuse un JWT avec un mauvais émetteur', async () => {
    const token = await sign(privateKey, {
      email: 'alice@example.test',
      iss: 'https://pirate.cloudflareaccess.com',
    });
    const res = await app({})({ 'Cf-Access-Jwt-Assertion': token });
    expect(res.status).toBe(401);
  });

  it('refuse un JWT expiré', async () => {
    const token = await sign(privateKey, { email: 'alice@example.test', exp: '-1m' });
    const res = await app({})({ 'Cf-Access-Jwt-Assertion': token });
    expect(res.status).toBe(401);
  });

  it('refuse un JWT signé avec un autre algorithme que RS256', async () => {
    const token = await new SignJWT({ email: 'alice@example.test' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k2' })
      .setIssuer(`https://${TEAM}`)
      .setAudience(AUD)
      .setExpirationTime('5m')
      .sign(ecPrivateKey);
    const res = await app({})({ 'Cf-Access-Jwt-Assertion': token });
    expect(res.status).toBe(401);
  });

  it('refuse un JWT valide mais sans e-mail', async () => {
    const token = await sign(privateKey, {});
    const res = await app({})({ 'Cf-Access-Jwt-Assertion': token });
    expect(res.status).toBe(401);
  });

  it('accepte une requête sans JWT en dev quand DEV_USER_EMAIL est défini et ACCESS_AUD absent', async () => {
    const res = await app({ DEV_USER_EMAIL: 'Dev@Example.test', ACCESS_AUD: undefined })();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'dev@example.test' });
  });

  it('en mode dev, l’en-tête x-dev-user-email choisit l’utilisateur (tests e2e multi-utilisateurs)', async () => {
    const res = await app({ DEV_USER_EMAIL: 'dev@example.test', ACCESS_AUD: undefined })({
      'x-dev-user-email': 'Bob@Example.test',
    });
    expect(await res.json()).toEqual({ email: 'bob@example.test' });
  });

  it('en mode dev, un en-tête x-dev-user-email invalide est ignoré', async () => {
    const res = await app({ DEV_USER_EMAIL: 'dev@example.test', ACCESS_AUD: undefined })({
      'x-dev-user-email': 'pas-un-email',
    });
    expect(await res.json()).toEqual({ email: 'dev@example.test' });
  });

  it('ignore x-dev-user-email quand ACCESS_AUD est configuré (production)', async () => {
    const token = await sign(privateKey, { email: 'alice@example.test' });
    const res = await app({ DEV_USER_EMAIL: 'dev@example.test' })({
      'Cf-Access-Jwt-Assertion': token,
      'x-dev-user-email': 'mallory@example.test',
    });
    expect(await res.json()).toEqual({ email: 'alice@example.test' });
  });

  it('ignore DEV_USER_EMAIL quand ACCESS_AUD est configuré (production)', async () => {
    const res = await app({ DEV_USER_EMAIL: 'dev@example.test' })();
    expect(res.status).toBe(401);
  });

  it('répond 500 si Access n’est pas configuré et qu’aucun mode dev n’est actif', async () => {
    const res = await app({ ACCESS_AUD: undefined, ACCESS_TEAM_DOMAIN: undefined })({
      'Cf-Access-Jwt-Assertion': 'x',
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'access_not_configured' });
  });
});
