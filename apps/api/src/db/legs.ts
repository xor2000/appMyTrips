import {
  staleLegs,
  tripRequiredLegKeys,
  type LatLng,
  type Leg,
  type LegMode,
  type LegValueSource,
  type RouteResult,
} from '@mytrips/core';
import { getStays, getSteps } from './steps';

interface LegRow {
  id: string;
  from_key: string;
  to_key: string;
  mode: LegMode;
  distance_m: number | null;
  duration_min: number;
  distance_source: LegValueSource;
  duration_source: LegValueSource;
  geometry: string | null;
  summary: string | null;
  depart_at: string | null;
  booking_ref: string | null;
  notes: string;
  computed_at: string | null;
}

function toLeg(r: LegRow): Leg {
  return {
    id: r.id,
    fromKey: r.from_key,
    toKey: r.to_key,
    mode: r.mode,
    distanceM: r.distance_m,
    durationMin: r.duration_min,
    distanceSource: r.distance_source,
    durationSource: r.duration_source,
    geometry: r.geometry,
    summary: r.summary,
    departAt: r.depart_at,
    bookingRef: r.booking_ref,
    notes: r.notes,
    computedAt: r.computed_at,
  };
}

export async function getLegs(db: D1Database, tripId: string): Promise<Leg[]> {
  const { results } = await db
    .prepare('SELECT * FROM legs WHERE trip_id = ? ORDER BY created_at, id')
    .bind(tripId)
    .all<LegRow>();
  return results.map(toLeg);
}

export async function getLeg(db: D1Database, tripId: string, legId: string): Promise<Leg | null> {
  const row = await db
    .prepare('SELECT * FROM legs WHERE id = ? AND trip_id = ?')
    .bind(legId, tripId)
    .first<LegRow>();
  return row ? toLeg(row) : null;
}

/**
 * Supprime les trajets dont la paire n'est plus consécutive (réordonnancement, changement de
 * jour, suppression…). Appelé juste après une écriture, et conditionné à la version lue : si une
 * autre écriture est passée entre-temps, rien n'est supprimé (elle fera son propre nettoyage).
 */
export async function pruneStaleLegs(db: D1Database, tripId: string): Promise<void> {
  const [version, days, steps, stays, legs] = await Promise.all([
    db.prepare('SELECT version FROM trips WHERE id = ?').bind(tripId).first<number>('version'),
    db
      .prepare('SELECT id, date FROM days WHERE trip_id = ?')
      .bind(tripId)
      .all<{ id: string; date: string }>(),
    getSteps(db, tripId),
    getStays(db, tripId),
    getLegs(db, tripId),
  ]);
  if (version === null || legs.length === 0) return;
  const stale = staleLegs(legs, tripRequiredLegKeys(days.results, steps, stays));
  if (stale.length === 0) return;
  await db.batch(
    stale.map((l) =>
      db
        .prepare('DELETE FROM legs WHERE id = ? AND (SELECT version FROM trips WHERE id = ?) = ?')
        .bind(l.id, tripId, version),
    ),
  );
}

/** Durée de validité d'un itinéraire en cache (6 h pour bus et train : horaires). */
export function routeCacheTtlMs(mode: LegMode) {
  return mode === 'bus' || mode === 'train' ? 6 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
}

const round5 = (n: number) => n.toFixed(5);

/** Clé du cache : mode, points arrondis à 5 décimales, tranche horaire pour bus et train. */
export function routeCacheKey(mode: LegMode, from: LatLng, to: LatLng, departAt?: string) {
  const points = `${round5(from.lat)},${round5(from.lng)}>${round5(to.lat)},${round5(to.lng)}`;
  const slot = (mode === 'bus' || mode === 'train') && departAt ? `:${departAt.slice(0, 13)}` : '';
  // « v2 » : tracés complets ; les entrées plus anciennes (tracés allégés à 600 points) sont
  // ignorées et recalculées.
  return `${mode}:v2:${points}${slot}`;
}

export async function getCachedRoute(
  db: D1Database,
  key: string,
  ttlMs: number,
  now = Date.now(),
): Promise<RouteResult | null> {
  const since = new Date(now - ttlMs).toISOString();
  const payload = await db
    .prepare('SELECT payload FROM route_cache WHERE key = ? AND created_at > ?')
    .bind(key, since)
    .first<string>('payload');
  return payload ? (JSON.parse(payload) as RouteResult) : null;
}

export async function putCachedRoute(db: D1Database, key: string, route: RouteResult) {
  await db
    .prepare('INSERT OR REPLACE INTO route_cache (key, payload, created_at) VALUES (?, ?, ?)')
    .bind(key, JSON.stringify(route), new Date().toISOString())
    .run();
}
