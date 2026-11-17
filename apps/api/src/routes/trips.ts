import {
  DayPatch,
  Email,
  MemberPut,
  TripCreate,
  TripPatch,
  datesInPeriod,
  diffPeriod,
  isDayEmpty,
} from '@mytrips/core';
import { Hono, type Context } from 'hono';
import { pruneStaleLegs } from '../db/legs';
import { getDays, getSnapshot, getTrip, listTrips } from '../db/trips';
import {
  access,
  expectedVersion,
  now,
  parseBody,
  versionConflict,
  writeWithVersion,
  type TripsEnv,
} from './shared';
import { registerBatchRoute } from './batch';
import { registerInvitationRoutes } from './invitations';
import { dayBoundsOk, invalidDayBoundsBody, planDayUpdate } from './plans';
import { registerStepRoutes } from './steps';
import { coverIsAllowed } from './covers';

function invalidDayBounds(c: Context) {
  return c.json(invalidDayBoundsBody, 400);
}

/** Nombre d'étapes par jour du voyage. */
async function stepCountsByDay(db: D1Database, tripId: string): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      'SELECT day_id, COUNT(*) AS n FROM steps WHERE trip_id = ? AND day_id IS NOT NULL GROUP BY day_id',
    )
    .bind(tripId)
    .all<{ day_id: string; n: number }>();
  return new Map(results.map((r) => [r.day_id, r.n]));
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
  if (p.cover && !coverIsAllowed(p.cover, c.env.COMMONS_URL)) {
    return c.json({ error: 'invalid_cover' }, 400);
  }
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
    cover: 'cover',
  };
  // La photo est stockée en JSON (null l'efface).
  const entries = (Object.keys(p) as (keyof typeof p)[]).map(
    (k) => [columns[k], k === 'cover' ? (p.cover ? JSON.stringify(p.cover) : null) : p[k]] as const,
  );
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
    const counts = await stepCountsByDay(db, id);
    const notEmpty = removed
      .filter((d) => !isDayEmpty(d, counts.get(d.id) ?? 0))
      .map((d) => d.date);
    if (notEmpty.length > 0 && c.req.query('force') !== 'true') {
      return c.json({ error: 'days_not_empty', dates: notEmpty }, 409);
    }
    removedIds = removed.map((d) => d.id);
  }

  const ok = await writeWithVersion(db, id, expected, tripSet, (guard, g) => [
    // Les étapes des jours supprimés passent dans la liste d'idées (dossiers compris).
    ...removedIds.map((dayId) =>
      db.prepare(`UPDATE steps SET day_id = NULL WHERE day_id = ? AND ${guard}`).bind(dayId, ...g),
    ),
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
  // Jours retirés : leurs étapes passent dans les idées, leurs trajets deviennent caducs.
  await pruneStaleLegs(db, id);
  return c.json(await getSnapshot(db, id, c.get('role')));
});

trips.delete('/:id', access('owner'), async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.batch([
    db.prepare('DELETE FROM legs WHERE trip_id = ?').bind(id),
    db.prepare('DELETE FROM steps WHERE trip_id = ?').bind(id),
    db.prepare('DELETE FROM stays WHERE trip_id = ?').bind(id),
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

  const trip = await getTrip(db, id);
  if (!trip) return c.json({ error: 'not_found' }, 404);
  const plan = await planDayUpdate(db, trip, dayId, body.data);
  if ('error' in plan) return c.json(plan.error.body, plan.error.status);

  const ok = await writeWithVersion(db, id, expected, null, plan.statements);
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
  // Change le rôle d'un membre existant. On devient membre en acceptant une invitation : l'ajout
  // direct par e-mail donnerait accès à quiconque s'inscrit avec cette adresse.
  const res = await c.env.DB.prepare(
    'UPDATE trip_members SET role = ? WHERE trip_id = ? AND email = ?',
  )
    .bind(body.data.role, id, email.data)
    .run();
  if (res.meta.changes !== 1) return c.json({ error: 'not_member' }, 404);
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

registerStepRoutes(trips);
registerInvitationRoutes(trips);
registerBatchRoute(trips);
