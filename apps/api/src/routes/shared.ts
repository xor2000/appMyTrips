import { TripId, type TripRole } from '@mytrips/core';
import type { Context, MiddlewareHandler } from 'hono';
import type { z } from 'zod';
import type { AuthEnv } from '../auth';
import { getRole, getTrip } from '../db/trips';

export type TripsEnv = AuthEnv & { Variables: { role: TripRole } };
type Level = 'read' | 'write' | 'owner';

/** Charge le rôle de l'utilisateur sur le voyage :id et vérifie le niveau d'accès demandé. */
export function access(level: Level): MiddlewareHandler<TripsEnv> {
  return async (c, next) => {
    const id = c.req.param('id') ?? '';
    // Un non-membre reçoit 404 : il ne doit pas savoir que le voyage existe.
    if (!TripId.safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const role = await getRole(c.env.DB, id, c.get('userEmail'));
    if (!role) return c.json({ error: 'not_found' }, 404);
    if (level === 'write' && role === 'viewer') return c.json({ error: 'forbidden' }, 403);
    if (level === 'owner' && role !== 'owner') return c.json({ error: 'forbidden' }, 403);
    c.set('role', role);
    await next();
  };
}

/** Corps JSON validé par `schema`, ou réponse 400 prête à renvoyer. */
export async function parseBody<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<{ data: z.infer<S> } | { error: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { error: c.json({ error: 'invalid_json' }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: c.json({ error: 'invalid', issues: parsed.error.issues }, 400) };
  }
  return { data: parsed.data };
}

/** Version attendue (en-tête If-Match), ou null si absente ou illisible. */
export function expectedVersion(c: Context): number | null {
  const raw = c.req.header('if-match')?.replace(/^W\//, '').replaceAll('"', '').trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const now = () => new Date().toISOString();

/**
 * Exécute `statements` dans une transaction D1, seulement si la version du voyage vaut encore
 * `expected` : la version est incrémentée en premier, et chaque autre requête est conditionnée à la
 * nouvelle version. Renvoie false en cas de conflit (rien n'est alors modifié).
 */
export async function writeWithVersion(
  db: D1Database,
  tripId: string,
  expected: number,
  tripSet: { sql: string; values: unknown[] } | null,
  statements: (guard: string, guardValues: unknown[]) => D1PreparedStatement[],
): Promise<boolean> {
  const set = tripSet ? `${tripSet.sql}, ` : '';
  const bump = db
    .prepare(
      `UPDATE trips SET ${set}version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
    )
    .bind(...(tripSet?.values ?? []), now(), tripId, expected);
  const guard = '(SELECT version FROM trips WHERE id = ?) = ?';
  const results = await db.batch([bump, ...statements(guard, [tripId, expected + 1])]);
  return (results[0]?.meta.changes ?? 0) === 1;
}

export async function versionConflict(c: Context<TripsEnv>, tripId: string) {
  const trip = await getTrip(c.env.DB, tripId);
  return c.json({ error: 'version_conflict', version: trip?.version ?? null }, 409);
}

/** Version attendue, ou réponse 428 prête à renvoyer. */
export function requireVersion(c: Context): number | Response {
  const expected = expectedVersion(c);
  return expected === null ? c.json({ error: 'version_required' }, 428) : expected;
}
