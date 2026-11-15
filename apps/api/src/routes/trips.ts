import {
  DayPatch,
  Email,
  MemberPut,
  TripCreate,
  TripId,
  TripPatch,
  datesInPeriod,
  diffPeriod,
  type TripRole,
} from '@mytrips/core';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type { z } from 'zod';
import type { AuthEnv } from '../auth';
import { getDays, getRole, getSnapshot, getTrip, listTrips } from '../db/trips';

type TripsEnv = AuthEnv & { Variables: { role: TripRole } };
type Level = 'read' | 'write' | 'owner';

/** Charge le rôle de l'utilisateur sur le voyage :id et vérifie le niveau d'accès demandé. */
function access(level: Level): MiddlewareHandler<TripsEnv> {
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
async function parseBody<S extends z.ZodType>(
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
function expectedVersion(c: Context): number | null {
  const raw = c.req.header('if-match')?.replace(/^W\//, '').replaceAll('"', '').trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

const now = () => new Date().toISOString();

/** La journée doit finir après son début (heures HH:mm comparables en texte). */
const dayBoundsOk = (start: string, end: string) => start < end;

function invalidDayBounds(c: Context) {
  return c.json(
    {
      error: 'invalid',
      issues: [{ path: ['dayEnd'], message: 'La journée doit finir après son début' }],
    },
    400,
  );
}

/**
 * Exécute `statements` dans une transaction D1, seulement si la version du voyage vaut encore
 * `expected` : la version est incrémentée en premier, et chaque autre requête est conditionnée à la
 * nouvelle version. Renvoie false en cas de conflit (rien n'est alors modifié).
 */
async function writeWithVersion(
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

async function versionConflict(c: Context<TripsEnv>, tripId: string) {
  const trip = await getTrip(c.env.DB, tripId);
  return c.json({ error: 'version_conflict', version: trip?.version ?? null }, 409);
}

export const trips = new Hono<TripsEnv>();

trips.get('/', async (c) => {
  return c.json({ trips: await listTrips(c.env.DB, c.get('userEmail')) });
});

trips.post('/', async (c) => {
  const body = await parseBody(c, TripCreate);
  if ('error' in body) return body.error;
  const t = body.data;
  const id = crypto.randomUUID();
  const ts = now();
  const db = c.env.DB;
  await db.batch([
    db
      .prepare(
        `INSERT INTO trips (id, owner_email, name, start_date, end_date, day_start, day_end,
           default_timezone, hike_speed_kmh, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        c.get('userEmail'),
        t.name,
        t.startDate,
        t.endDate,
        t.dayStart,
        t.dayEnd,
        t.defaultTimezone,
        t.hikeSpeedKmh,
        ts,
        ts,
      ),
    ...datesInPeriod(t.startDate, t.endDate).map((date) =>
      db
        .prepare('INSERT INTO days (id, trip_id, date) VALUES (?, ?, ?)')
        .bind(crypto.randomUUID(), id, date),
    ),
  ]);
  return c.json(await getSnapshot(db, id, 'owner'), 201);
});

trips.get('/:id', access('read'), async (c) => {
  return c.json(await getSnapshot(c.env.DB, c.req.param('id'), c.get('role')));
});

trips.patch('/:id', access('write'), async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const body = await parseBody(c, TripPatch);
  if ('error' in body) return body.error;
  const expected = expectedVersion(c);
  if (expected === null) return c.json({ error: 'version_required' }, 428);

  const current = await getTrip(db, id);
  if (!current) return c.json({ error: 'not_found' }, 404);
  if (current.version !== expected) return versionConflict(c, id);

  const p = body.data;
  if (!dayBoundsOk(p.dayStart ?? current.dayStart, p.dayEnd ?? current.dayEnd)) {
    return invalidDayBounds(c);
  }
  const columns: Record<keyof typeof p, string> = {
    name: 'name',
    startDate: 'start_date',
    endDate: 'end_date',
    dayStart: 'day_start',
    dayEnd: 'day_end',
    defaultTimezone: 'default_timezone',
    hikeSpeedKmh: 'hike_speed_kmh',
  };
  const entries = (Object.keys(p) as (keyof typeof p)[]).map((k) => [columns[k], p[k]] as const);
  const tripSet = {
    sql: entries.map(([col]) => `${col} = ?`).join(', '),
    values: entries.map(([, v]) => v),
  };

  // Changement de période : jours à créer et à supprimer.
  let toAdd: string[] = [];
  let removedIds: string[] = [];
  if (p.startDate && p.endDate) {
    const days = await getDays(db, id);
    const diff = diffPeriod(
      days.map((d) => d.date),
      p.startDate,
      p.endDate,
    );
    toAdd = diff.toAdd;
    const removed = days.filter((d) => diff.toRemove.includes(d.date));
    // Un jour est « non vide » s'il a des notes (les étapes s'y ajouteront au lot 2).
    const notEmpty = removed.filter((d) => d.notes.trim() !== '').map((d) => d.date);
    if (notEmpty.length > 0 && c.req.query('force') !== 'true') {
      return c.json({ error: 'days_not_empty', dates: notEmpty }, 409);
    }
    removedIds = removed.map((d) => d.id);
  }

  const ok = await writeWithVersion(db, id, expected, tripSet, (guard, g) => [
    ...removedIds.map((dayId) =>
      db.prepare(`DELETE FROM days WHERE id = ? AND ${guard}`).bind(dayId, ...g),
    ),
    ...toAdd.map((date) =>
      db
        .prepare(`INSERT INTO days (id, trip_id, date) SELECT ?, ?, ? WHERE ${guard}`)
        .bind(crypto.randomUUID(), id, date, ...g),
    ),
  ]);
  if (!ok) return versionConflict(c, id);
  return c.json(await getSnapshot(db, id, c.get('role')));
});

trips.delete('/:id', access('owner'), async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.batch([
    db.prepare('DELETE FROM days WHERE trip_id = ?').bind(id),
    db.prepare('DELETE FROM trip_members WHERE trip_id = ?').bind(id),
    db.prepare('DELETE FROM trips WHERE id = ?').bind(id),
  ]);
  return c.body(null, 204);
});

trips.patch('/:id/days/:dayId', access('write'), async (c) => {
  const id = c.req.param('id');
  const dayId = c.req.param('dayId');
  const db = c.env.DB;
  const body = await parseBody(c, DayPatch);
  if ('error' in body) return body.error;
  const expected = expectedVersion(c);
  if (expected === null) return c.json({ error: 'version_required' }, 428);

  const day = await db
    .prepare('SELECT day_start, day_end FROM days WHERE id = ? AND trip_id = ?')
    .bind(dayId, id)
    .first<{ day_start: string | null; day_end: string | null }>();
  if (!day) return c.json({ error: 'not_found' }, 404);
  const trip = await getTrip(db, id);
  if (!trip) return c.json({ error: 'not_found' }, 404);

  const p = body.data;
  const effectiveStart = (p.dayStart !== undefined ? p.dayStart : day.day_start) ?? trip.dayStart;
  const effectiveEnd = (p.dayEnd !== undefined ? p.dayEnd : day.day_end) ?? trip.dayEnd;
  if (!dayBoundsOk(effectiveStart, effectiveEnd)) return invalidDayBounds(c);
  const columns = { notes: 'notes', dayStart: 'day_start', dayEnd: 'day_end' } as const;
  const keys = (Object.keys(columns) as (keyof typeof columns)[]).filter((k) => p[k] !== undefined);
  const set = keys.map((k) => `${columns[k]} = ?`).join(', ');

  const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
    db
      .prepare(`UPDATE days SET ${set} WHERE id = ? AND ${guard}`)
      .bind(...keys.map((k) => p[k]), dayId, ...g),
  ]);
  if (!ok) return versionConflict(c, id);
  return c.json(await getSnapshot(db, id, c.get('role')));
});

trips.put('/:id/members/:email', access('owner'), async (c) => {
  const id = c.req.param('id');
  const email = Email.safeParse(c.req.param('email'));
  if (!email.success) return c.json({ error: 'invalid_email' }, 400);
  const body = await parseBody(c, MemberPut);
  if ('error' in body) return body.error;
  if (email.data === c.get('userEmail')) {
    return c.json({ error: 'owner_cannot_be_member' }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO trip_members (trip_id, email, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (trip_id, email) DO UPDATE SET role = excluded.role`,
  )
    .bind(id, email.data, body.data.role, now())
    .run();
  return c.body(null, 204);
});

trips.delete('/:id/members/:email', access('owner'), async (c) => {
  const email = Email.safeParse(c.req.param('email'));
  if (!email.success) return c.json({ error: 'invalid_email' }, 400);
  await c.env.DB.prepare('DELETE FROM trip_members WHERE trip_id = ? AND email = ?')
    .bind(c.req.param('id'), email.data)
    .run();
  return c.body(null, 204);
});
