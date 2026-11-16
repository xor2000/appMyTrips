import type { Stay, Step, StepKind, StepType } from '@mytrips/core';

export interface StepRow {
  id: string;
  day_id: string | null;
  parent_id: string | null;
  position: string;
  kind: StepKind;
  type: StepType | null;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  exit_lat: number | null;
  exit_lng: number | null;
  duration_min: number;
  fixed_start: string | null;
  timezone: string | null;
  opening_hours: string | null;
  osm_ref: string | null;
  booking_ref: string | null;
  booking_url: string | null;
  notes: string;
}

interface StayRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string;
  check_out_time: string;
  booking_ref: string | null;
  notes: string;
}

export function toStep(r: StepRow): Step {
  return {
    id: r.id,
    dayId: r.day_id,
    parentId: r.parent_id,
    position: r.position,
    kind: r.kind,
    type: r.type,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    exitLat: r.exit_lat,
    exitLng: r.exit_lng,
    durationMin: r.duration_min,
    fixedStart: r.fixed_start,
    timezone: r.timezone,
    openingHours: r.opening_hours,
    osmRef: r.osm_ref,
    bookingRef: r.booking_ref,
    bookingUrl: r.booking_url,
    notes: r.notes,
  };
}

function toStay(r: StayRow): Stay {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    checkInDate: r.check_in_date,
    checkInTime: r.check_in_time,
    checkOutDate: r.check_out_date,
    checkOutTime: r.check_out_time,
    bookingRef: r.booking_ref,
    notes: r.notes,
  };
}

const STEP_COLUMNS = `id, day_id, parent_id, position, kind, type, name, lat, lng, address, exit_lat,
  exit_lng, duration_min, fixed_start, timezone, opening_hours, osm_ref, booking_ref, booking_url, notes`;

export async function getSteps(db: D1Database, tripId: string): Promise<Step[]> {
  const { results } = await db
    .prepare(`SELECT ${STEP_COLUMNS} FROM steps WHERE trip_id = ? ORDER BY position, id`)
    .bind(tripId)
    .all<StepRow>();
  return results.map(toStep);
}

export async function getStep(
  db: D1Database,
  tripId: string,
  stepId: string,
): Promise<Step | null> {
  const row = await db
    .prepare(`SELECT ${STEP_COLUMNS} FROM steps WHERE id = ? AND trip_id = ?`)
    .bind(stepId, tripId)
    .first<StepRow>();
  return row ? toStep(row) : null;
}

export async function getStays(db: D1Database, tripId: string): Promise<Stay[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, lat, lng, address, check_in_date, check_in_time, check_out_date,
              check_out_time, booking_ref, notes
       FROM stays WHERE trip_id = ? ORDER BY check_in_date, id`,
    )
    .bind(tripId)
    .all<StayRow>();
  return results.map(toStay);
}
