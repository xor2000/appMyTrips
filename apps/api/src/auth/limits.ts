/**
 * Limites des routes d'authentification et bannissement d'IP (tables auth_attempts, ip_bans).
 */

const MINUTE = 60 * 1000;
/** Échecs de connexion depuis une IP avant son bannissement (fenêtre de 15 minutes). */
export const BAN_AFTER_FAILURES = 3;
/** Échecs de connexion sur un même e-mail avant refus (429), toutes IP confondues. */
export const MAX_EMAIL_FAILURES = 5;
/** Inscriptions par IP et par heure. */
export const MAX_SIGNUPS_PER_HOUR = 5;
const FAILURE_WINDOW = 15 * MINUTE;
const SIGNUP_WINDOW = 60 * MINUTE;
/** Les tentatives plus anciennes ne servent plus à rien : elles sont purgées. */
const RETENTION = 24 * 60 * MINUTE;

const since = (ms: number) => new Date(Date.now() - ms).toISOString();

export async function isBanned(db: D1Database, ip: string): Promise<boolean> {
  return (await db.prepare('SELECT 1 FROM ip_bans WHERE ip = ?').bind(ip).first()) !== null;
}

async function count(db: D1Database, sql: string, ...values: unknown[]): Promise<number> {
  const row = await db
    .prepare(sql)
    .bind(...values)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Trop d'échecs récents sur cet e-mail (attaque répartie sur plusieurs IP). */
export async function emailLocked(db: D1Database, email: string): Promise<boolean> {
  const n = await count(
    db,
    "SELECT COUNT(*) AS n FROM auth_attempts WHERE kind = 'login_failure' AND email = ? AND created_at > ?",
    email,
    since(FAILURE_WINDOW),
  );
  return n >= MAX_EMAIL_FAILURES;
}

/** Enregistre un échec de connexion ; bannit l'IP au 3ᵉ échec en 15 minutes. */
export async function recordLoginFailure(db: D1Database, ip: string, email: string): Promise<void> {
  const ts = new Date().toISOString();
  await db.batch([
    db.prepare('DELETE FROM auth_attempts WHERE created_at < ?').bind(since(RETENTION)),
    db
      .prepare(
        "INSERT INTO auth_attempts (kind, ip, email, created_at) VALUES ('login_failure', ?, ?, ?)",
      )
      .bind(ip, email, ts),
  ]);
  const failures = await count(
    db,
    "SELECT COUNT(*) AS n FROM auth_attempts WHERE kind = 'login_failure' AND ip = ? AND created_at > ?",
    ip,
    since(FAILURE_WINDOW),
  );
  if (failures >= BAN_AFTER_FAILURES) {
    await db
      .prepare(
        `INSERT INTO ip_bans (ip, banned_at, last_email, failures) VALUES (?, ?, ?, ?)
         ON CONFLICT (ip) DO NOTHING`,
      )
      .bind(ip, ts, email, failures)
      .run();
  }
}

/** Connexion réussie : les compteurs de l'IP et de l'e-mail repartent de zéro. */
export async function clearLoginFailures(db: D1Database, ip: string, email: string): Promise<void> {
  await db
    .prepare("DELETE FROM auth_attempts WHERE kind = 'login_failure' AND (ip = ? OR email = ?)")
    .bind(ip, email)
    .run();
}

export async function signupLimitReached(db: D1Database, ip: string): Promise<boolean> {
  const n = await count(
    db,
    "SELECT COUNT(*) AS n FROM auth_attempts WHERE kind = 'signup' AND ip = ? AND created_at > ?",
    ip,
    since(SIGNUP_WINDOW),
  );
  return n >= MAX_SIGNUPS_PER_HOUR;
}

export function recordSignup(db: D1Database, ip: string, email: string): D1PreparedStatement {
  return db
    .prepare("INSERT INTO auth_attempts (kind, ip, email, created_at) VALUES ('signup', ?, ?, ?)")
    .bind(ip, email, new Date().toISOString());
}

/** Réactivation par un admin : le bannissement et les échecs de l'IP sont effacés. */
export async function unban(db: D1Database, ip: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM ip_bans WHERE ip = ?').bind(ip),
    db.prepare("DELETE FROM auth_attempts WHERE kind = 'login_failure' AND ip = ?").bind(ip),
  ]);
}

export interface IpBan {
  ip: string;
  bannedAt: string;
  lastEmail: string | null;
  failures: number;
}

export async function listBans(db: D1Database): Promise<IpBan[]> {
  const { results } = await db
    .prepare(
      'SELECT ip, banned_at AS bannedAt, last_email AS lastEmail, failures FROM ip_bans ORDER BY banned_at DESC',
    )
    .all<IpBan>();
  return results;
}
