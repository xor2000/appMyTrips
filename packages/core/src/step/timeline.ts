import { sortByPosition } from './order';
import type { Stay, Step } from './schemas';

/** Occurrence d'un séjour dans un jour : départ du matin ou retour du soir. Non stockée. */
export interface StayItem {
  kind: 'stay';
  /** Clé stable, utilisée aussi par les trajets (lot 4). */
  key: string;
  stay: Stay;
  edge: 'start' | 'end';
  label: 'check-in' | 'check-out' | 'départ' | 'retour';
}

export interface StepItem {
  kind: 'step';
  key: string;
  step: Step;
}

export interface GroupItem {
  kind: 'group';
  key: string;
  group: Step;
  children: Step[];
}

export type TimelineItem = StayItem | StepItem | GroupItem;

/**
 * Timeline d'un jour : séjour du matin, étapes et dossiers triés par position (enfants triés sous
 * leur dossier), séjour du soir.
 */
export function dayTimeline(
  date: string,
  steps: readonly Step[],
  stays: readonly Stay[],
): TimelineItem[] {
  // Matin : séjour dont une nuit précède ce jour. Soir : séjour dont une nuit suit ce jour.
  const morning = stays.find((s) => s.checkInDate < date && date <= s.checkOutDate);
  const evening = stays.find((s) => s.checkInDate <= date && date < s.checkOutDate);

  const children = new Map<string, Step[]>();
  for (const s of steps) {
    if (s.parentId) children.set(s.parentId, [...(children.get(s.parentId) ?? []), s]);
  }

  const items: TimelineItem[] = [];
  if (morning) {
    items.push({
      kind: 'stay',
      key: `stay:${morning.id}:${date}:start`,
      stay: morning,
      edge: 'start',
      label: date === morning.checkOutDate ? 'check-out' : 'départ',
    });
  }
  for (const s of sortByPosition(steps.filter((s) => !s.parentId))) {
    if (s.kind === 'group') {
      items.push({
        kind: 'group',
        key: s.id,
        group: s,
        children: sortByPosition(children.get(s.id) ?? []),
      });
    } else {
      items.push({ kind: 'step', key: s.id, step: s });
    }
  }
  if (evening) {
    items.push({
      kind: 'stay',
      key: `stay:${evening.id}:${date}:end`,
      stay: evening,
      edge: 'end',
      label: date === evening.checkInDate ? 'check-in' : 'retour',
    });
  }
  return items;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Point de passage du jour : on y arrive par `entry` et on en repart par `exit`. */
export interface RoutePoint {
  key: string;
  label: string;
  entry: LatLng;
  exit: LatLng;
}

function stepPoint(s: Step): RoutePoint | null {
  if (s.lat === null || s.lng === null) return null;
  const entry = { lat: s.lat, lng: s.lng };
  const exit =
    s.exitLat !== null && s.exitLng !== null ? { lat: s.exitLat, lng: s.exitLng } : entry;
  return { key: s.id, label: s.name, entry, exit };
}

/** Points du jour dans l'ordre, dossiers aplatis : base des trajets (lot 4) et de la carte. */
export function dayRoute(items: readonly TimelineItem[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const item of items) {
    if (item.kind === 'stay') {
      const p = { lat: item.stay.lat, lng: item.stay.lng };
      points.push({ key: item.key, label: item.stay.name, entry: p, exit: p });
    } else if (item.kind === 'step') {
      const p = stepPoint(item.step);
      if (p) points.push(p);
    } else {
      for (const child of item.children) {
        const p = stepPoint(child);
        if (p) points.push(p);
      }
    }
  }
  return points;
}

/** Un jour est vide s'il n'a ni notes ni étapes (il peut alors être supprimé sans confirmation). */
export function isDayEmpty(day: { notes: string }, stepCount: number): boolean {
  return day.notes.trim() === '' && stepCount === 0;
}
