import { env } from 'cloudflare:test';
import { createApp } from '../src/app';

/** Origine des requêtes de test (`app.request` construit des URL http://localhost/…). */
export const ORIGIN = 'http://localhost';

export interface RawResult {
  status: number;
  body: any;
  /** Valeur du cookie de session posé par la réponse (null si effacé, undefined si absent). */
  session: string | null | undefined;
  setCookie: string | null;
}

/**
 * Appelle l'application complète, avec la vraie authentification par session. Chaque test choisit
 * son IP (`ip`) pour ne pas partager compteurs et bannissements avec les autres tests.
 */
export async function raw(
  method: string,
  path: string,
  options: {
    body?: unknown;
    session?: string;
    ip?: string;
    origin?: string | null;
    bindings?: Record<string, unknown>;
  } = {},
): Promise<RawResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.session) headers.cookie = `__Host-session=${options.session}`;
  if (options.ip) headers['cf-connecting-ip'] = options.ip;
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  const res = await createApp().request(
    path,
    {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    },
    { ...env, ...options.bindings },
  );
  const text = await res.text();
  const setCookie = res.headers.get('set-cookie');
  const match = setCookie ? /__Host-session=([^;]*)/.exec(setCookie) : null;
  return {
    status: res.status,
    body: text ? JSON.parse(text) : null,
    session: match ? match[1] || null : undefined,
    setCookie,
  };
}

/** Adresse IPv6 fictive (plage de documentation 2001:db8::/32), propre à l'appelant. */
export const freshIp = () => {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16);
  return `2001:db8:${hex()}:${hex()}::${hex()}`;
};

let emailCounter = 0;
export const freshEmail = (label = 'user') =>
  `${label}-${Date.now()}-${emailCounter++}@example.test`;

/** Résout le captcha (« Combien font 7 + 5 ? »). */
export function solve(question: string): string {
  const [a, b] = (question.match(/-?\d+/g) ?? []).map(Number);
  return String((a ?? 0) + (b ?? 0));
}

/** Inscrit un compte (captcha résolu) et renvoie sa session. */
export async function signup(
  email = freshEmail(),
  password = 'mot-de-passe-1',
  ip = freshIp(),
): Promise<{ email: string; password: string; session: string }> {
  const captcha = await raw('GET', '/api/auth/captcha', { ip });
  const res = await raw('POST', '/api/auth/signup', {
    ip,
    body: {
      email,
      password,
      captcha: { token: captcha.body.token, answer: solve(captcha.body.question) },
    },
  });
  if (res.status !== 201 || !res.session) {
    throw new Error(`inscription impossible : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { email, password, session: res.session };
}
