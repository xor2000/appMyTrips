import { fromBase64Url, hmac, timingSafeEqualText, toBase64Url } from './crypto';

/** Durée de validité d'un captcha. */
export const CAPTCHA_TTL_MS = 10 * 60 * 1000;

const decoder = new TextDecoder();

/**
 * Captcha fait maison : une addition. Le jeton porte un identifiant et une date d'expiration,
 * signés avec la réponse attendue (HMAC, secret AUTH_SECRET) : la réponse n'y figure pas en clair.
 */
export async function createCaptcha(
  secret: string,
  nowMs = Date.now(),
): Promise<{ question: string; token: string }> {
  const [a, b] = crypto.getRandomValues(new Uint8Array(2));
  const x = ((a ?? 0) % 9) + 1;
  const y = ((b ?? 0) % 9) + 1;
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ id: crypto.randomUUID(), exp: nowMs + CAPTCHA_TTL_MS }),
    ),
  );
  const signature = await hmac(secret, `captcha.${payload}.${x + y}`);
  return { question: `Combien font ${x} + ${y} ?`, token: `${payload}.${signature}` };
}

/**
 * Vérifie la réponse. Un jeton bien formé et non expiré est consommé dès sa première
 * présentation, même avec une mauvaise réponse : il ne sert qu'une fois.
 */
export async function checkCaptcha(
  db: D1Database,
  secret: string,
  token: string,
  answer: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return false;
  const bytes = fromBase64Url(payload);
  if (!bytes) return false;
  let data: { id?: unknown; exp?: unknown };
  try {
    data = JSON.parse(decoder.decode(bytes));
  } catch {
    return false;
  }
  if (typeof data.id !== 'string' || typeof data.exp !== 'number' || data.exp <= nowMs) {
    return false;
  }
  const nowIso = new Date(nowMs).toISOString();
  const [, inserted] = await db.batch([
    db.prepare('DELETE FROM captcha_used WHERE expires_at < ?').bind(nowIso),
    db
      .prepare(
        'INSERT INTO captcha_used (id, expires_at) VALUES (?, ?) ON CONFLICT (id) DO NOTHING',
      )
      .bind(data.id, new Date(data.exp).toISOString()),
  ]);
  if ((inserted?.meta.changes ?? 0) !== 1) return false;
  const expected = await hmac(secret, `captcha.${payload}.${Number(answer)}`);
  return timingSafeEqualText(expected, signature);
}
