import {
  parseIllustration,
  type Day,
  type Member,
  type Role,
  type Trip,
  type TripRole,
  type TripSnapshot,
  type TripSummary,
} from '@mytrips/core';
import { getLegs } from './legs';
import { getStays, getSteps } from './steps';

interface TripRow {
  id: string;
  owner_email: string;
  name: string;
  start_date: string;
  end_date: string;
  day_start: string;
  day_end: string;
  default_timezone: string;
  hike_speed_kmh: number;
  illustration: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface DayRow {
  id: string;
  date: string;
  day_start: string | null;
  day_end: string | null;
  notes: string;
}

function toTrip(r: TripRow): Trip {
  return {
    id: r.id,
    ownerEmail: r.owner_email,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    dayStart: r.day_start,
    dayEnd: r.day_end,
    defaultTimezone: r.default_timezone,
    hikeSpeedKmh: r.hike_speed_kmh,
    illustration: parseIllustration(r.illustration),
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toDay(r: DayRow): Day {
  return { id: r.id, date: r.date, dayStart: r.day_start, dayEnd: r.day_end, notes: r.notes };
}

/** Rôle de `email` sur le voyage, ou null s'il n'y a pas accès (ou si le voyage n'existe pas). */
export async function getRole(
  db: D1Database,
  tripId: string,
  email: string,
): Promise<TripRole | null> {
  const row = await db
    .prepare(
      `SELECT t.owner_email AS owner, m.role AS role
       FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.email = ?2
       WHERE t.id = ?1`,
    )
    .bind(tripId, email)
    .first<{ owner: string; role: Role | null }>();
  if (!row) return null;
  if (row.owner === email) return 'owner';
  return row.role;
}

export async function getTrip(db: D1Database, tripId: string): Promise<Trip | null> {
  const row = await db.prepare('SELECT * FROM trips WHERE id = ?').bind(tripId).first<TripRow>();
  return row ? toTrip(row) : null;
}

export async function getDays(db: D1Database, tripId: string): Promise<Day[]> {
  const { results } = await db
    .prepare('SELECT id, date, day_start, day_end, notes FROM days WHERE trip_id = ? ORDER BY date')
    .bind(tripId)
    .all<DayRow>();
  return results.map(toDay);
}

export async function getMembers(db: D1Database, tripId: string): Promise<Member[]> {
  const { results } = await db
    .prepare('SELECT email, role FROM trip_members WHERE trip_id = ? ORDER BY email')
    .bind(tripId)
    .all<Member>();
  return results;
}

/** Voyage complet tel que renvoyé par GET /api/trips/:id. */
export async function getSnapshot(
  db: D1Database,
  tripId: string,
  role: TripRole,
): Promise<TripSnapshot> {
  const [trip, days, members, steps, stays, legs] = await Promise.all([
    getTrip(db, tripId),
    getDays(db, tripId),
    getMembers(db, tripId),
    getSteps(db, tripId),
    getStays(db, tripId),
    getLegs(db, tripId),
  ]);
  if (!trip) throw new Error(`Voyage ${tripId} introuvable`);
  return { trip, role, days, members, steps, stays, legs };
}

/** Voyages possédés par `email` ou partagés avec lui, triés par date de début. */
export async function listTrips(db: D1Database, email: string): Promise<TripSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT t.*,
              CASE WHEN t.owner_email = ?1 THEN 'owner' ELSE m.role END AS role,
              (SELECT COUNT(*) FROM days d WHERE d.trip_id = t.id) AS day_count,
              (SELECT COUNT(*) FROM steps s
                 WHERE s.trip_id = t.id AND s.kind = 'step' AND s.day_id IS NOT NULL) AS step_count,
              (SELECT COALESCE(SUM(l.distance_m), 0) FROM legs l WHERE l.trip_id = t.id)
                AS distance_m,
              (SELECT json_group_array(name) FROM (
                 SELECT s.name FROM steps s JOIN days d ON d.id = s.day_id
                 WHERE s.trip_id = t.id AND s.kind = 'step'
                 ORDER BY d.date, s.position
                 LIMIT 3)) AS places
       FROM trips t LEFT JOIN trip_members m ON m.trip_id = t.id AND m.email = ?1
       WHERE t.owner_email = ?1 OR m.email IS NOT NULL
       ORDER BY t.start_date, t.name`,
    )
    .bind(email)
    .all<
      TripRow & {
        role: TripRole;
        day_count: number;
        step_count: number;
        distance_m: number;
        places: string;
      }
    >();
  return results.map((r) => ({
    ...toTrip(r),
    role: r.role,
    dayCount: r.day_count,
    stepCount: r.step_count,
    distanceM: Math.round(r.distance_m),
    places: JSON.parse(r.places) as string[],
  }));
}
