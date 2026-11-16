import { fromBase64Url, timingSafeEqual, toBase64Url } from './crypto';

/**
 * Répétitions PBKDF2-SHA256. Le Worker gratuit n'a que 10 ms de CPU par requête : 5000
 * répétitions prennent environ 6 ms dans workerd (10000 : 11 ms). Le format versionné permet de
 * renforcer plus tard (Workers Paid) : une empreinte plus faible est recalculée à la connexion.
 */
export const PASSWORD_ITERATIONS = 5000;

const PREFIX = 'pbkdf2-sha256';
const encoder = new TextEncoder();

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Empreinte `pbkdf2-sha256$<itérations>$<sel>$<empreinte>`, avec un sel aléatoire de 16 octets. */
export async function hashPassword(
  password: string,
  iterations = PASSWORD_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

/**
 * Vérifie un mot de passe. `needsRehash` : l'empreinte est valide mais plus faible que la
 * configuration actuelle, à recalculer.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  const [prefix, iter, saltText, hashText, ...rest] = stored.split('$');
  const iterations = Number(iter);
  const salt = saltText === undefined ? null : fromBase64Url(saltText);
  const expected = hashText === undefined ? null : fromBase64Url(hashText);
  if (
    prefix !== PREFIX ||
    rest.length > 0 ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > 100_000 ||
    !salt ||
    !expected
  ) {
    return { ok: false, needsRehash: false };
  }
  const actual = await derive(password, salt, iterations);
  const ok = timingSafeEqual(actual, expected);
  return { ok, needsRehash: ok && iterations < PASSWORD_ITERATIONS };
}

/**
 * Empreinte factice (sel et empreinte aléatoires, aucun mot de passe ne lui correspond), vérifiée
 * pour un compte inconnu afin que la durée ne trahisse rien. Constante : la calculer à la volée
 * doublerait le coût CPU de la requête.
 */
export const DUMMY_HASH = `${PREFIX}$${PASSWORD_ITERATIONS}$Em5LMXw9TTgQdD02ARLVUg$Rj8Q8E4F9rKcjXjSLJ8zLEguzHfpxhMjSqOJnv42cOQ`;
