import {
  StayCreate,
  StayPatch,
  StepCreate,
  StepPatch,
  keyAt,
  keysBetween,
  sortByPosition,
  type Step,
} from '@mytrips/core';
import tzLookup from '@photostructure/tz-lookup';
import type { Context, Hono } from 'hono';
import { getStep, getSteps } from '../db/steps';
import { getSnapshot } from '../db/trips';
import {
  access,
  now,
  parseBody,
  requireVersion,
  versionConflict,
  writeWithVersion,
  type TripsEnv,
} from './shared';

/** Fuseau IANA du point, ou null si indéterminable. */
function timezoneAt(lat: number, lng: number): string | null {
  try {
    return tzLookup(lat, lng);
  } catch {
    return null;
  }
}

async function dayBelongsToTrip(
  db: D1Database,
  tripId: string,
  dayId: string | null,
): Promise<boolean> {
  if (dayId === null) return true;
  const row = await db
    .prepare('SELECT 1 FROM days WHERE id = ? AND trip_id = ?')
    .bind(dayId, tripId)
    .first();
  return row !== null;
}

/**
 * Vérifie qu'une étape peut être rangée dans `parentId` : le parent est un dossier du même voyage,
 * du même jour, lui-même à la racine ; un dossier ne peut pas être rangé dans un autre.
 */
async function parentIsValid(
  db: D1Database,
  tripId: string,
  parentId: string | null,
  kind: Step['kind'],
  dayId: string | null,
): Promise<boolean> {
  if (parentId === null) return true;
  if (kind === 'group') return false;
  const parent = await getStep(db, tripId, parentId);
  return (
    parent !== null && parent.kind === 'group' && parent.parentId === null && parent.dayId === dayId
  );
}

/** Clé de position en fin de liste parmi les frères (même jour, même parent). */
async function lastPosition(
  db: D1Database,
  tripId: string,
  dayId: string | null,
  parentId: string | null,
) {
  const row = await db
    .prepare(
      'SELECT MAX(position) AS last FROM steps WHERE trip_id = ? AND day_id IS ? AND parent_id IS ?',
    )
    .bind(tripId, dayId, parentId)
    .first<{ last: string | null }>();
  return keyAt(row?.last ? [row.last] : [], row?.last ? 1 : 0);
}

async function snapshot(c: Context<TripsEnv>, status: 200 | 201 = 200) {
  return c.json(await getSnapshot(c.env.DB, c.req.param('id') ?? '', c.get('role')), status);
}

/** Routes des étapes, dossiers et séjours, montées sur le routeur des voyages. */
export function registerStepRoutes(trips: Hono<TripsEnv>) {
  trips.post('/:id/steps', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const body = await parseBody(c, StepCreate);
    if ('error' in body) return body.error;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;

    const s = body.data;
    if (!(await dayBelongsToTrip(db, id, s.dayId))) return c.json({ error: 'invalid_day' }, 400);
    if (!(await parentIsValid(db, id, s.parentId, s.kind, s.dayId))) {
      return c.json({ error: 'invalid_parent' }, 400);
    }
    const position = s.position ?? (await lastPosition(db, id, s.dayId, s.parentId));
    const hasPoint = s.kind === 'step' && s.lat !== undefined && s.lng !== undefined;
    const ts = now();

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      db
        .prepare(
          `INSERT INTO steps (id, trip_id, day_id, parent_id, position, kind, type, name, lat, lng,
             address, duration_min, fixed_start, timezone, opening_hours, osm_ref, booking_ref,
             booking_url, notes, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          s.dayId,
          s.parentId,
          position,
          s.kind,
          s.type,
          s.name,
          hasPoint ? s.lat : null,
          hasPoint ? s.lng : null,
          s.address ?? null,
          s.durationMin,
          s.fixedStart,
          hasPoint ? timezoneAt(s.lat!, s.lng!) : null,
          s.openingHours ?? null,
          s.osmRef ?? null,
          s.bookingRef ?? null,
          s.bookingUrl ?? null,
          s.notes,
          ts,
          ts,
          ...g,
        ),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c, 201);
  });

  trips.patch('/:id/steps/:stepId', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const body = await parseBody(c, StepPatch);
    if ('error' in body) return body.error;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;

    const step = await getStep(db, id, c.req.param('stepId'));
    if (!step) return c.json({ error: 'not_found' }, 404);
    const p = body.data;

    if (step.kind === 'group' && (p.lat !== undefined || p.type !== undefined || p.parentId)) {
      return c.json(
        { error: 'invalid', issues: [{ message: 'Un dossier n’a ni lieu ni type' }] },
        400,
      );
    }

    const dayId = p.dayId !== undefined ? p.dayId : step.dayId;
    const dayChanged = dayId !== step.dayId;
    // Changer de jour sans préciser de dossier sort l'étape de son dossier.
    const parentId = p.parentId !== undefined ? p.parentId : dayChanged ? null : step.parentId;
    const parentChanged = parentId !== step.parentId;
    if (!(await dayBelongsToTrip(db, id, dayId))) return c.json({ error: 'invalid_day' }, 400);
    if (!(await parentIsValid(db, id, parentId, step.kind, dayId))) {
      return c.json({ error: 'invalid_parent' }, 400);
    }
    const position =
      p.position ??
      (dayChanged || parentChanged ? await lastPosition(db, id, dayId, parentId) : step.position);

    const fields: Record<string, unknown> = {
      day_id: dayId,
      parent_id: parentId,
      position,
    };
    const columns = {
      type: 'type',
      name: 'name',
      lat: 'lat',
      lng: 'lng',
      address: 'address',
      exitLat: 'exit_lat',
      exitLng: 'exit_lng',
      durationMin: 'duration_min',
      fixedStart: 'fixed_start',
      notes: 'notes',
      bookingRef: 'booking_ref',
      bookingUrl: 'booking_url',
      openingHours: 'opening_hours',
    } as const;
    for (const k of Object.keys(columns) as (keyof typeof columns)[]) {
      if (p[k] !== undefined) fields[columns[k]] = p[k];
    }
    if (p.lat !== undefined && p.lng !== undefined) fields.timezone = timezoneAt(p.lat, p.lng);
    fields.updated_at = now();
    const cols = Object.keys(fields);

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      db
        .prepare(
          `UPDATE steps SET ${cols.map((col) => `${col} = ?`).join(', ')} WHERE id = ? AND ${guard}`,
        )
        .bind(...cols.map((col) => fields[col]), step.id, ...g),
      // Un dossier emporte ses étapes quand il change de jour.
      ...(step.kind === 'group' && dayChanged
        ? [
            db
              .prepare(`UPDATE steps SET day_id = ? WHERE parent_id = ? AND ${guard}`)
              .bind(dayId, step.id, ...g),
          ]
        : []),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c);
  });

  trips.delete('/:id/steps/:stepId', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;

    const step = await getStep(db, id, c.req.param('stepId'));
    if (!step) return c.json({ error: 'not_found' }, 404);

    const all = await getSteps(db, id);
    const children = sortByPosition(all.filter((s) => s.parentId === step.id));
    const mode = c.req.query('children');
    if (children.length > 0 && mode !== 'keep' && mode !== 'delete') {
      return c.json({ error: 'children_mode_required' }, 400);
    }

    // « keep » : les étapes du dossier reprennent sa place, dans leur ordre.
    let kept: { id: string; position: string }[] = [];
    if (children.length > 0 && mode === 'keep') {
      const siblings = sortByPosition(
        all.filter((s) => s.dayId === step.dayId && s.parentId === null),
      );
      const index = siblings.findIndex((s) => s.id === step.id);
      const before = siblings[index - 1]?.position ?? null;
      const after = siblings[index + 1]?.position ?? null;
      const keys = keysBetween(before, after, children.length);
      kept = children.map((child, i) => ({ id: child.id, position: keys[i]! }));
    }

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      ...kept.map((k) =>
        db
          .prepare(`UPDATE steps SET parent_id = NULL, position = ? WHERE id = ? AND ${guard}`)
          .bind(k.position, k.id, ...g),
      ),
      db.prepare(`DELETE FROM steps WHERE parent_id = ? AND ${guard}`).bind(step.id, ...g),
      db.prepare(`DELETE FROM steps WHERE id = ? AND ${guard}`).bind(step.id, ...g),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c);
  });

  trips.post('/:id/stays', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const body = await parseBody(c, StayCreate);
    if ('error' in body) return body.error;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;
    const s = body.data;
    const ts = now();

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      db
        .prepare(
          `INSERT INTO stays (id, trip_id, name, lat, lng, address, check_in_date, check_in_time,
             check_out_date, check_out_time, booking_ref, notes, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          s.name,
          s.lat,
          s.lng,
          s.address ?? null,
          s.checkInDate,
          s.checkInTime,
          s.checkOutDate,
          s.checkOutTime,
          s.bookingRef ?? null,
          s.notes,
          ts,
          ts,
          ...g,
        ),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c, 201);
  });

  trips.patch('/:id/stays/:stayId', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const body = await parseBody(c, StayPatch);
    if ('error' in body) return body.error;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;

    const stayId = c.req.param('stayId');
    const exists = await db
      .prepare('SELECT 1 FROM stays WHERE id = ? AND trip_id = ?')
      .bind(stayId, id)
      .first();
    if (!exists) return c.json({ error: 'not_found' }, 404);

    const columns = {
      name: 'name',
      lat: 'lat',
      lng: 'lng',
      address: 'address',
      checkInDate: 'check_in_date',
      checkInTime: 'check_in_time',
      checkOutDate: 'check_out_date',
      checkOutTime: 'check_out_time',
      bookingRef: 'booking_ref',
      notes: 'notes',
    } as const;
    const p = body.data;
    const keys = (Object.keys(columns) as (keyof typeof columns)[]).filter(
      (k) => p[k] !== undefined,
    );
    const set = [...keys.map((k) => `${columns[k]} = ?`), 'updated_at = ?'].join(', ');

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      db
        .prepare(`UPDATE stays SET ${set} WHERE id = ? AND ${guard}`)
        .bind(...keys.map((k) => p[k]), now(), stayId, ...g),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c);
  });

  trips.delete('/:id/stays/:stayId', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;
    const stayId = c.req.param('stayId');
    const exists = await db
      .prepare('SELECT 1 FROM stays WHERE id = ? AND trip_id = ?')
      .bind(stayId, id)
      .first();
    if (!exists) return c.json({ error: 'not_found' }, 404);

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      db.prepare(`DELETE FROM stays WHERE id = ? AND ${guard}`).bind(stayId, ...g),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c);
  });
}
