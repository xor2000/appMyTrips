import { env } from 'cloudflare:test';
import type { MiddlewareHandler } from 'hono';
import { createApp } from '../src/app';
import type { AuthEnv } from '../src/auth';

/** Authentification de test : l'e-mail vient de l'en-tête x-test-user. */
const testAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = c.req.header('x-test-user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('userEmail', user);
  await next();
};

const app = createApp({ auth: testAuth });

export const ALICE = 'alice@example.test';
export const BOB = 'bob@example.test';
export const CAROL = 'carol@example.test';
export const MALLORY = 'mallory@example.test';

export interface CallResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

/** Appelle l'API (avec la vraie base D1 du runtime de test) au nom d'un utilisateur. */
export async function call<T = any>(
  user: string,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<CallResult<T>> {
  const res = await app.request(
    path,
    {
      method,
      headers: { 'x-test-user': user, 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

/** Crée un voyage de 3 jours (10 au 12 juillet 2026) appartenant à `owner`. */
export async function createTrip(owner = ALICE, overrides: Record<string, unknown> = {}) {
  const res = await call(owner, 'POST', '/api/trips', {
    name: 'Voyage test Alpes',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`création impossible : ${JSON.stringify(res.body)}`);
  return res.body;
}
