import {
  LegCreate,
  LegPatch,
  RouteRequest,
  dayTimeline,
  estimatedDeparture,
  legValues,
  requiredLegs,
  resolveDayBounds,
  scheduleDay,
  zonedTimeToUtc,
  type LatLng,
  type LegMode,
  type RequiredLeg,
  type RouteResult,
} from '@mytrips/core';
import { Hono, type Context } from 'hono';
import type { AuthEnv } from '../auth';
import type { Bindings } from '../env';
import {
  getCachedRoute,
  getLeg,
  getLegs,
  putCachedRoute,
  routeCacheKey,
  routeCacheTtlMs,
} from '../db/legs';
import { getStays, getSteps } from '../db/steps';
import { getDays, getSnapshot, getTrip } from '../db/trips';
import { NoRouteError, computeRoute, isCacheable } from '../routing/providers';
import {
  access,
  now,
  parseBody,
  requireVersion,
  versionConflict,
  writeWithVersion,
  type TripsEnv,
} from './shared';
import { timezoneAt } from './plans';

/** Itinéraire, depuis le cache si possible. Lève NoRouteError. */
async function routeWithCache(
  env: Bindings,
  fetchImpl: typeof fetch,
  mode: LegMode,
  from: LatLng,
  to: LatLng,
  departAt?: string,
): Promise<RouteResult> {
  const key = routeCacheKey(mode, from, to, departAt);
  const cached = await getCachedRoute(env.DB, key, routeCacheTtlMs(mode));
  if (cached) return cached;
  const route = await computeRoute(env, fetchImpl, mode, from, to, departAt);
  if (isCacheable(mode, route)) await putCachedRoute(env.DB, key, route);
  return route;
}

/** Contexte d'une paire requise : ses points, la date du jour et l'heure de départ estimée. */
interface PairContext {
  leg: RequiredLeg;
  date: string;
  previous: { fixedStart: string | null; durationMin: number } | null;
  timezone: string;
}

/** Retrouve la paire (départ, arrivée) parmi les trajets requis des jours du voyage. */
async function findPair(
  db: D1Database,
  tripId: string,
  fromKey: string,
  toKey: string,
): Promise<PairContext | null> {
  const [trip, days, steps, stays, legs] = await Promise.all([
    getTrip(db, tripId),
    getDays(db, tripId),
    getSteps(db, tripId),
    getStays(db, tripId),
    getLegs(db, tripId),
  ]);
  if (!trip) return null;
  for (const day of days) {
    const items = dayTimeline(
      day.date,
      steps.filter((s) => s.dayId === day.id),
      stays,
    );
    const leg = requiredLegs(items).find((l) => l.fromKey === fromKey && l.toKey === toKey);
    if (!leg) continue;
    const step = steps.find((s) => s.id === fromKey);
    const stay = fromKey.startsWith('stay:')
      ? stays.find((s) => fromKey.startsWith(`stay:${s.id}:`))
      : null;
    // Départ estimé : fin de l'étape de départ selon les horaires calculés du jour.
    const schedule = scheduleDay({
      date: day.date,
      steps: steps.filter((s) => s.dayId === day.id),
      stays,
      legs,
      ...resolveDayBounds(day, trip),
      timezone: trip.defaultTimezone,
    });
    const end = schedule.items.find((i) => i.key === fromKey)?.end;
    return {
      leg,
      date: day.date,
      previous: end
        ? { fixedStart: end.dayOffset === 0 ? end.time : '23:59', durationMin: 0 }
        : null,
      timezone:
        step?.timezone ?? (stay ? timezoneAt(stay.lat, stay.lng) : null) ?? trip.defaultTimezone,
    };
  }
  return null;
}

/** Calcul pour une paire : null si aucun itinéraire n'existe. */
async function routePair(
  c: Context<TripsEnv>,
  fetchImpl: typeof fetch,
  pair: PairContext,
  mode: LegMode,
  departAt: string | null,
): Promise<RouteResult | null> {
  const transit = mode === 'bus' || mode === 'train';
  const when = transit
    ? zonedTimeToUtc(pair.date, estimatedDeparture({ departAt }, pair.previous), pair.timezone)
    : undefined;
  try {
    return await routeWithCache(c.env, fetchImpl, mode, pair.leg.from, pair.leg.to, when);
  } catch (e) {
    if (e instanceof NoRouteError) return null;
    throw e;
  }
}

async function snapshot(c: Context<TripsEnv>, status: 200 | 201 = 200) {
  return c.json(await getSnapshot(c.env.DB, c.req.param('id') ?? '', c.get('role')), status);
}

/** Trajets d'un voyage (montés sous /trips, à côté des routes du voyage). */
export function legRoutes(fetchImpl: typeof fetch) {
  const routes = new Hono<TripsEnv>();

  routes.post('/:id/legs', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const body = await parseBody(c, LegCreate);
    if ('error' in body) return body.error;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;
    const l = body.data;

    const pair = await findPair(db, id, l.fromKey, l.toKey);
    if (!pair) return c.json({ error: 'invalid_leg' }, 400);
    const routed = await routePair(c, fetchImpl, pair, l.mode, l.departAt ?? null);
    const values = legValues(l.mode, routed, {
      distanceM: l.distanceM,
      durationMin: l.durationMin,
    });
    if (!values) return c.json({ error: 'no_route' }, 422);
    const ts = now();

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      // Un seul trajet par paire : le nouveau remplace l'ancien.
      db
        .prepare(`DELETE FROM legs WHERE trip_id = ? AND from_key = ? AND to_key = ? AND ${guard}`)
        .bind(id, l.fromKey, l.toKey, ...g),
      db
        .prepare(
          `INSERT INTO legs (id, trip_id, from_key, to_key, mode, distance_m, duration_min,
             distance_source, duration_source, geometry, summary, depart_at, booking_ref, notes,
             computed_at, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          l.fromKey,
          l.toKey,
          l.mode,
          values.distanceM,
          values.durationMin,
          values.distanceSource,
          values.durationSource,
          routed?.geometry ?? null,
          routed?.summary ?? null,
          l.departAt ?? null,
          l.bookingRef ?? null,
          l.notes,
          routed ? ts : null,
          ts,
          ts,
          ...g,
        ),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c, 201);
  });

  routes.patch('/:id/legs/:legId', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const body = await parseBody(c, LegPatch);
    if ('error' in body) return body.error;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;
    const leg = await getLeg(db, id, c.req.param('legId'));
    if (!leg) return c.json({ error: 'not_found' }, 404);
    const p = body.data;

    const mode = p.mode ?? leg.mode;
    const departAt = p.departAt !== undefined ? p.departAt : leg.departAt;
    const transit = mode === 'bus' || mode === 'train';
    const fields: Record<string, unknown> = { mode, depart_at: departAt };
    if (p.bookingRef !== undefined) fields.booking_ref = p.bookingRef;
    if (p.notes !== undefined) fields.notes = p.notes;

    const needsRoute =
      p.mode !== undefined ||
      p.recompute === true ||
      p.distanceM !== undefined ||
      p.durationMin !== undefined ||
      (p.departAt !== undefined && transit);
    if (needsRoute) {
      const pair = await findPair(db, id, leg.fromKey, leg.toKey);
      if (!pair) return c.json({ error: 'invalid_leg' }, 400);
      const routed = await routePair(c, fetchImpl, pair, mode, departAt);
      // Une valeur saisie reste saisie, sauf si elle est remise au routeur (null).
      const manual = {
        distanceM:
          p.distanceM !== undefined
            ? p.distanceM
            : leg.distanceSource === 'manual'
              ? leg.distanceM
              : null,
        durationMin:
          p.durationMin !== undefined
            ? p.durationMin
            : leg.durationSource === 'manual'
              ? leg.durationMin
              : null,
      };
      const values = legValues(mode, routed, manual);
      if (!values) return c.json({ error: 'no_route' }, 422);
      Object.assign(fields, {
        distance_m: values.distanceM,
        duration_min: values.durationMin,
        distance_source: values.distanceSource,
        duration_source: values.durationSource,
        geometry: routed?.geometry ?? null,
        summary: routed?.summary ?? null,
        computed_at: routed ? now() : leg.computedAt,
      });
    }
    fields.updated_at = now();
    const cols = Object.keys(fields);

    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      db
        .prepare(
          `UPDATE legs SET ${cols.map((col) => `${col} = ?`).join(', ')} WHERE id = ? AND ${guard}`,
        )
        .bind(...cols.map((col) => fields[col]), leg.id, ...g),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c);
  });

  routes.delete('/:id/legs/:legId', access('write'), async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const expected = requireVersion(c);
    if (expected instanceof Response) return expected;
    const leg = await getLeg(db, id, c.req.param('legId'));
    if (!leg) return c.json({ error: 'not_found' }, 404);
    const ok = await writeWithVersion(db, id, expected, null, (guard, g) => [
      db.prepare(`DELETE FROM legs WHERE id = ? AND ${guard}`).bind(leg.id, ...g),
    ]);
    if (!ok) return versionConflict(c, id);
    return snapshot(c);
  });

  return routes;
}

/** Calcul d'itinéraire seul (POST /api/route), sans voyage. */
export function routeRoutes(fetchImpl: typeof fetch) {
  const routes = new Hono<AuthEnv>();
  routes.post('/', async (c) => {
    const body = await parseBody(c, RouteRequest);
    if ('error' in body) return body.error;
    const r = body.data;
    try {
      return c.json({
        route: await routeWithCache(c.env, fetchImpl, r.mode, r.from, r.to, r.departAt),
      });
    } catch (e) {
      if (e instanceof NoRouteError) return c.json({ error: 'no_route' }, 422);
      throw e;
    }
  });
  return routes;
}
