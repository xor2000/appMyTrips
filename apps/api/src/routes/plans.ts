import {
  hikeDurationMin,
  keyAt,
  type DayPatch,
  type Step,
  type StepPatch,
  type Trip,
} from '@mytrips/core';
import tzLookup from '@photostructure/tz-lookup';
import { getStep } from '../db/steps';
import { getTrip } from '../db/trips';
import { now } from './shared';

/**
 * Préparation des écritures d'étape et de jour, partagée par les routes unitaires et par le lot
 * atomique (`POST /api/trips/:id/batch`) : validation, puis requêtes à exécuter sous la garde de
 * version de `writeWithVersion`.
 */
export type Plan =
  | { error: { status: 400 | 404; body: Record<string, unknown> } }
  | { statements: (guard: string, guardValues: unknown[]) => D1PreparedStatement[] };

/** Fuseau IANA du point, ou null si indéterminable. */
export function timezoneAt(lat: number, lng: number): string | null {
  try {
    return tzLookup(lat, lng);
  } catch {
    return null;
  }
}

export async function dayBelongsToTrip(
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
export async function parentIsValid(
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
export async function lastPosition(
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

const STEP_COLUMNS = {
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

/**
 * Modification d'une étape (champs et déplacement). Changer de jour sans préciser de dossier sort
 * l'étape de son dossier ; un dossier emporte ses étapes ; un lieu déplacé perd ses trajets
 * calculés (les saisies manuelles sont gardées).
 */
export async function planStepUpdate(
  db: D1Database,
  tripId: string,
  step: Step,
  p: StepPatch,
): Promise<Plan> {
  if (step.kind === 'group' && (p.lat !== undefined || p.type !== undefined || p.parentId)) {
    return {
      error: {
        status: 400,
        body: { error: 'invalid', issues: [{ message: 'Un dossier n’a ni lieu ni type' }] },
      },
    };
  }
  const dayId = p.dayId !== undefined ? p.dayId : step.dayId;
  const dayChanged = dayId !== step.dayId;
  const parentId = p.parentId !== undefined ? p.parentId : dayChanged ? null : step.parentId;
  const parentChanged = parentId !== step.parentId;
  if (!(await dayBelongsToTrip(db, tripId, dayId))) {
    return { error: { status: 400, body: { error: 'invalid_day' } } };
  }
  if (!(await parentIsValid(db, tripId, parentId, step.kind, dayId))) {
    return { error: { status: 400, body: { error: 'invalid_parent' } } };
  }
  const position =
    p.position ??
    (dayChanged || parentChanged ? await lastPosition(db, tripId, dayId, parentId) : step.position);

  const fields: Record<string, unknown> = { day_id: dayId, parent_id: parentId, position };
  for (const k of Object.keys(STEP_COLUMNS) as (keyof typeof STEP_COLUMNS)[]) {
    if (p[k] !== undefined) fields[STEP_COLUMNS[k]] = p[k];
  }
  if (p.lat !== undefined && p.lng !== undefined) fields.timezone = timezoneAt(p.lat, p.lng);
  // Randonnée GPX : une durée saisie devient manuelle ; l'option dénivelé recalcule la durée.
  if (p.useElevation !== undefined) fields.use_elevation = p.useElevation ? 1 : 0;
  if (step.gpx && p.durationMin !== undefined) fields.duration_manual = 1;
  else if (step.gpx && p.useElevation !== undefined) {
    const trip = await getTrip(db, tripId);
    fields.duration_manual = 0;
    fields.duration_min = hikeDurationMin(
      step.gpx.stats,
      trip?.hikeSpeedKmh ?? 3.5,
      p.useElevation,
    );
  }
  fields.updated_at = now();
  const cols = Object.keys(fields);
  const moved = p.lat !== undefined || p.exitLat !== undefined || p.exitLng !== undefined;

  return {
    statements: (guard, g) => [
      db
        .prepare(
          `UPDATE steps SET ${cols.map((col) => `${col} = ?`).join(', ')} WHERE id = ? AND ${guard}`,
        )
        .bind(...cols.map((col) => fields[col]), step.id, ...g),
      // Lieu déplacé : ses trajets calculés sont faux (ceux saisis à la main sont gardés).
      ...(moved
        ? [
            db
              .prepare(
                `DELETE FROM legs WHERE trip_id = ? AND (from_key = ? OR to_key = ?)
                 AND distance_source != 'manual' AND duration_source != 'manual' AND ${guard}`,
              )
              .bind(tripId, step.id, step.id, ...g),
          ]
        : []),
      // Un dossier emporte ses étapes quand il change de jour.
      ...(step.kind === 'group' && dayChanged
        ? [
            db
              .prepare(`UPDATE steps SET day_id = ? WHERE parent_id = ? AND ${guard}`)
              .bind(dayId, step.id, ...g),
          ]
        : []),
    ],
  };
}

/** La journée doit finir après son début (heures HH:mm comparables en texte). */
export const dayBoundsOk = (start: string, end: string) => start < end;

export const invalidDayBoundsBody = {
  error: 'invalid',
  issues: [{ path: ['dayEnd'], message: 'La journée doit finir après son début' }],
};

/** Modification d'un jour (notes, heures) ; les heures sont vérifiées avec les valeurs existantes. */
export async function planDayUpdate(
  db: D1Database,
  trip: Trip,
  dayId: string,
  p: DayPatch,
): Promise<Plan> {
  const day = await db
    .prepare('SELECT day_start, day_end FROM days WHERE id = ? AND trip_id = ?')
    .bind(dayId, trip.id)
    .first<{ day_start: string | null; day_end: string | null }>();
  if (!day) return { error: { status: 404, body: { error: 'not_found' } } };
  const effectiveStart = (p.dayStart !== undefined ? p.dayStart : day.day_start) ?? trip.dayStart;
  const effectiveEnd = (p.dayEnd !== undefined ? p.dayEnd : day.day_end) ?? trip.dayEnd;
  if (!dayBoundsOk(effectiveStart, effectiveEnd)) {
    return { error: { status: 400, body: invalidDayBoundsBody } };
  }
  const columns = { notes: 'notes', dayStart: 'day_start', dayEnd: 'day_end' } as const;
  const keys = (Object.keys(columns) as (keyof typeof columns)[]).filter((k) => p[k] !== undefined);
  const set = keys.map((k) => `${columns[k]} = ?`).join(', ');
  return {
    statements: (guard, g) => [
      db
        .prepare(`UPDATE days SET ${set} WHERE id = ? AND ${guard}`)
        .bind(...keys.map((k) => p[k]), dayId, ...g),
    ],
  };
}
