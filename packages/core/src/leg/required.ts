import type { Stay, Step } from '../step/schemas';
import { dayRoute, dayTimeline, type LatLng, type TimelineItem } from '../step/timeline';

/** Trajet requis entre deux points consécutifs d'un jour. */
export interface RequiredLeg {
  fromKey: string;
  toKey: string;
  /** Point de sortie du départ (fin de randonnée…). */
  from: LatLng;
  /** Point d'entrée de l'arrivée. */
  to: LatLng;
}

/** Paires consécutives de la timeline d'un jour (dossiers aplatis, séjours compris). */
export function requiredLegs(items: readonly TimelineItem[]): RequiredLeg[] {
  const points = dayRoute(items);
  const legs: RequiredLeg[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    legs.push({ fromKey: a.key, toKey: b.key, from: a.exit, to: b.entry });
  }
  return legs;
}

/** Clé d'une paire (départ, arrivée). */
export const legPairKey = (fromKey: string, toKey: string) => `${fromKey}>${toKey}`;

/** Paires requises de tous les jours du voyage. */
export function tripRequiredLegKeys(
  days: readonly { id: string; date: string }[],
  steps: readonly Step[],
  stays: readonly Stay[],
): Set<string> {
  const keys = new Set<string>();
  for (const day of days) {
    const items = dayTimeline(
      day.date,
      steps.filter((s) => s.dayId === day.id),
      stays,
    );
    for (const leg of requiredLegs(items)) keys.add(legPairKey(leg.fromKey, leg.toKey));
  }
  return keys;
}

/** Trajets dont la paire n'est plus consécutive (réordonnancement, changement de jour…). */
export function staleLegs<L extends { fromKey: string; toKey: string }>(
  legs: readonly L[],
  required: ReadonlySet<string>,
): L[] {
  return legs.filter((l) => !required.has(legPairKey(l.fromKey, l.toKey)));
}
