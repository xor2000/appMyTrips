import { parseIllustration, type TripSnapshot, type TripSummary } from '@mytrips/core';
import { tripPhase } from '#lib/format.ts';

/** Voyages classés : le prochain (ou en cours), les autres à venir, les souvenirs. */
export interface TripGroups {
  /** Voyage en cours, sinon le prochain départ ; null s'il n'y en a pas. */
  next: TripSummary | null;
  /** Autres voyages en cours ou à venir, du plus proche au plus lointain. */
  upcoming: TripSummary[];
  /** Voyages passés, du plus récent au plus ancien. */
  past: TripSummary[];
}

/**
 * Voyages de la liste déroulante de l'en-tête et choix du voyage ouvert par « / » (il n'y a plus
 * de page d'accueil).
 */
export function groupTrips(trips: TripSummary[], today: string): TripGroups {
  const byStart = (a: TripSummary, b: TripSummary) =>
    a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name);
  const ongoing = trips.filter((t) => tripPhase(t.startDate, t.endDate, today) === 'ongoing');
  const future = trips.filter((t) => tripPhase(t.startDate, t.endDate, today) === 'upcoming');
  const active = [...ongoing.sort(byStart), ...future.sort(byStart)];
  const past = trips
    .filter((t) => tripPhase(t.startDate, t.endDate, today) === 'past')
    .sort((a, b) => b.endDate.localeCompare(a.endDate) || a.name.localeCompare(b.name));
  return { next: active[0] ?? null, upcoming: active.slice(1), past };
}

/**
 * Ligne de liste complète : une copie hors ligne enregistrée avant l'ajout des illustrations et des
 * chiffres n'a pas ces champs, et peut encore porter une ancienne photo (`cover`), oubliée.
 */
export function normalizeTripSummary(trip: TripSummary): TripSummary {
  const copy: TripSummary & { cover?: unknown } = { ...trip };
  delete copy.cover;
  return {
    ...copy,
    illustration: parseIllustration(trip.illustration),
    stepCount: trip.stepCount ?? 0,
    distanceM: trip.distanceM ?? 0,
    places: trip.places ?? [],
  };
}

/** Ligne de liste calculée depuis un voyage complet, comme le fait l'API (copie hors ligne). */
export function summaryFromSnapshot(snapshot: TripSnapshot): TripSummary {
  const dateOf = new Map(snapshot.days.map((d) => [d.id, d.date]));
  const placed = snapshot.steps
    .filter((s) => s.kind === 'step' && s.dayId !== null && dateOf.has(s.dayId))
    .sort(
      (a, b) =>
        dateOf.get(a.dayId!)!.localeCompare(dateOf.get(b.dayId!)!) ||
        a.position.localeCompare(b.position),
    );
  return {
    ...snapshot.trip,
    role: snapshot.role,
    dayCount: snapshot.days.length,
    stepCount: placed.length,
    distanceM: Math.round(snapshot.legs.reduce((sum, l) => sum + (l.distanceM ?? 0), 0)),
    places: placed.slice(0, 3).map((s) => s.name),
  };
}

/** Clé du dernier voyage consulté sur l'appareil (`localStorage`). */
export const LAST_TRIP_KEY = 'mytrips.lastTrip';

type LastTripStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): LastTripStorage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Dernier voyage consulté ; null s'il n'y en a pas ou si le stockage est bloqué. */
export function readLastTrip(storage: LastTripStorage | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(LAST_TRIP_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Mémorise le voyage consulté (sans effet si le stockage est bloqué). */
export function saveLastTrip(id: string, storage: LastTripStorage | null = defaultStorage()) {
  try {
    storage?.setItem(LAST_TRIP_KEY, id);
  } catch {
    // Stockage indisponible : « / » ouvrira le voyage en cours ou le prochain.
  }
}

/** Oublie ce voyage s'il est le dernier consulté (supprimé, introuvable). */
export function forgetLastTrip(id: string, storage: LastTripStorage | null = defaultStorage()) {
  try {
    if (storage?.getItem(LAST_TRIP_KEY) === id) storage.removeItem(LAST_TRIP_KEY);
  } catch {
    // Stockage indisponible : rien à oublier.
  }
}

/**
 * Voyage ouvert par « / » : le dernier consulté s'il est encore accessible, sinon le voyage en
 * cours ou le prochain départ, sinon le souvenir le plus récent ; null sans voyage.
 */
export function pickStartTrip(
  trips: TripSummary[],
  lastId: string | null,
  today: string,
): TripSummary | null {
  const last = lastId ? trips.find((t) => t.id === lastId) : undefined;
  if (last) return last;
  const groups = groupTrips(trips, today);
  return groups.next ?? groups.past[0] ?? null;
}
