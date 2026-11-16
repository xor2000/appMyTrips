import {
  StayCreate,
  StayPatch,
  StepCreate,
  StepPatch,
  keysBetween,
  sortByPosition,
} from '@mytrips/core';
import type { Context, Hono } from 'hono';
import { pruneStaleLegs } from '../db/legs';
import { getStep, getSteps } from '../db/steps';
import { dayBelongsToTrip, lastPosition, parentIsValid, planStepUpdate, timezoneAt } from './plans';
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

/** Voyage complet après une écriture, trajets devenus caducs retirés. */
async function snapshot(c: Context<TripsEnv>, status: 200 | 201 = 200) {
  const id = c.req.param('id') ?? '';
  await pruneStaleLegs(c.env.DB, id);
  return c.json(await getSnapshot(c.env.DB, id, c.get('role')), status);
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
    const plan = await planStepUpdate(db, id, step, body.data);
    if ('error' in plan) return c.json(plan.error.body, plan.error.status);

    const ok = await writeWithVersion(db, id, expected, null, plan.statements);
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
      // Lieu déplacé : trajets calculés de ses occurrences retirés (saisies manuelles gardées).
      ...(p.lat !== undefined
        ? [
            db
              .prepare(
                `DELETE FROM legs WHERE trip_id = ? AND (from_key LIKE ? OR to_key LIKE ?)
                 AND distance_source != 'manual' AND duration_source != 'manual' AND ${guard}`,
              )
              .bind(id, `stay:${stayId}:%`, `stay:${stayId}:%`, ...g),
          ]
        : []),
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
