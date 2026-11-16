import { env } from 'cloudflare:test';
import type { MiddlewareHandler } from 'hono';
import { createApp } from '../src/app';
import type { AuthEnv } from '../src/auth/session';

/** Authentification de test : l'e-mail vient de l'en-tête x-test-user. */
const testAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = c.req.header('x-test-user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('userEmail', user);
  await next();
};

export const ALICE = 'alice@example.test';
export const BOB = 'bob@example.test';
export const CAROL = 'carol@example.test';
export const MALLORY = 'mallory@example.test';

export interface CallResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export type Caller = <T = any>(
  user: string,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => Promise<CallResult<T>>;

/**
 * Appelant de l'API (vraie base D1 du runtime de test). `outboundFetch` remplace le fetch utilisé
 * pour les services externes (géocodage…) ; `bindings` complète ou remplace les bindings.
 */
export function makeCaller(
  outboundFetch?: typeof fetch,
  bindings: Partial<typeof env> = {},
): Caller {
  const app = createApp({ auth: testAuth, fetch: outboundFetch });
  return async (user, method, path, body, headers = {}) => {
    const res = await app.request(
      path,
      {
        method,
        headers: {
          'x-test-user': user,
          'content-type': 'application/json',
          // Contrôle CSRF : les écritures doivent venir de la même origine.
          origin: 'http://localhost',
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      { ...env, ...bindings },
    );
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };
}

export const call = makeCaller();

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

/** Ajoute une étape et renvoie le nouveau voyage complet ; échoue si l'API refuse. */
export async function addStep(
  tripId: string,
  version: number,
  step: Record<string, unknown>,
  user = ALICE,
) {
  const res = await call(user, 'POST', `/api/trips/${tripId}/steps`, step, {
    'if-match': String(version),
  });
  if (res.status !== 201) throw new Error(`ajout impossible : ${JSON.stringify(res.body)}`);
  return res.body;
}

/**
 * Ajoute directement un membre au voyage, comme le ferait l'acceptation d'une invitation (l'ajout
 * par e-mail n'existe plus dans l'API).
 */
export async function addMember(tripId: string, email: string, role: 'viewer' | 'editor') {
  await env.DB.prepare(
    `INSERT INTO trip_members (trip_id, email, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (trip_id, email) DO UPDATE SET role = excluded.role`,
  )
    .bind(tripId, email, role, new Date().toISOString())
    .run();
}
