import {
  LEG_COLOR_COUNT,
  dayLegColors,
  decodePolyline,
  legColorVar,
  legPairKey,
  requiredLegs,
  type Leg,
  type LegMode,
  type TimelineItem,
} from '@mytrips/core';
import Bike from 'lucide-svelte/icons/bike';
import Bus from 'lucide-svelte/icons/bus';
import Car from 'lucide-svelte/icons/car';
import Footprints from 'lucide-svelte/icons/footprints';
import Plane from 'lucide-svelte/icons/plane';
import Ship from 'lucide-svelte/icons/ship';
import TrainFront from 'lucide-svelte/icons/train-front';

/** Noms des couleurs de la palette des trajets (pastilles de la fenêtre du trajet). */
export const LEG_COLOR_NAMES = [
  'Sarcelle',
  'Bleu',
  'Violet',
  'Rose',
  'Orange',
  'Vert',
  'Cyan',
  'Ardoise',
] as const;

export const LEG_ICONS: Record<LegMode, typeof Car> = {
  car: Car,
  bike: Bike,
  walk: Footprints,
  bus: Bus,
  train: TrainFront,
  plane: Plane,
  ferry: Ship,
};

/** Paire d'étapes consécutives d'un jour, avec son trajet s'il existe. */
export interface DayPair {
  fromKey: string;
  toKey: string;
  leg: Leg | null;
  /** Variable CSS de la couleur du trajet (choisie ou automatique), null sans trajet. */
  color: string | null;
  /** Couleur (rang dans la palette) que le trajet prend en automatique, null sans trajet. */
  autoColor: number | null;
}

/**
 * Paires du jour indexées par leur départ (une tuile s'affiche après chaque point de départ).
 * Les trajets existants, dans l'ordre du jour, reçoivent leur couleur (`dayLegColors`).
 */
export function dayPairs(
  items: readonly TimelineItem[],
  legs: readonly Leg[],
): Map<string, DayPair> {
  const byPair = new Map(legs.map((l) => [legPairKey(l.fromKey, l.toKey), l]));
  const pairs = requiredLegs(items).map((r) => ({
    fromKey: r.fromKey,
    toKey: r.toKey,
    leg: byPair.get(legPairKey(r.fromKey, r.toKey)) ?? null,
  }));
  const present = pairs.flatMap((p) => (p.leg ? [p.leg] : []));
  const colors = dayLegColors(present);
  // Couleur automatique : celle qui suit le trajet précédent (même règle que `dayLegColors`).
  const autos = present.map((_, i) => (i === 0 ? 0 : (colors[i - 1]! + 1) % LEG_COLOR_COUNT));
  const colorOf = new Map(present.map((l, i) => [l.id, { color: colors[i]!, auto: autos[i]! }]));
  return new Map(
    pairs.map((p) => {
      const c = p.leg ? colorOf.get(p.leg.id) : undefined;
      return [
        p.fromKey,
        { ...p, color: c ? legColorVar(c.color) : null, autoColor: c ? c.auto : null },
      ];
    }),
  );
}

/** Couleur automatique d'un trajet créé sur la paire `fromKey` : celle qui suit le trajet précédent. */
export function newLegAutoColor(pairs: ReadonlyMap<string, DayPair>, fromKey: string): number {
  let previous = -1;
  for (const p of pairs.values()) {
    if (p.fromKey === fromKey) break;
    if (p.leg) previous = p.leg.color ?? p.autoColor ?? previous;
  }
  return (previous + 1) % LEG_COLOR_COUNT;
}

export const isManual = (leg: Leg) =>
  leg.distanceSource === 'manual' || leg.durationSource === 'manual';

/** Origine affichée : « forcé » (saisie), « estimé » (calcul local), sinon « routeur ». */
export function legSourceLabel(leg: Leg): 'forcé' | 'estimé' | 'routeur' {
  if (isManual(leg)) return 'forcé';
  if (leg.distanceSource === 'estimate' || leg.durationSource === 'estimate') return 'estimé';
  return 'routeur';
}

/** Trajet saisi à la main, retiré par un réordonnancement, qui touche la paire : à reprendre. */
export function suggestionFor(
  pair: { fromKey: string; toKey: string },
  removed: readonly Leg[],
): Leg | null {
  const keys = new Set([pair.fromKey, pair.toKey]);
  return removed.find((l) => isManual(l) && (keys.has(l.fromKey) || keys.has(l.toKey))) ?? null;
}

/** Tracé d'un trajet sur la carte. */
export interface LegLine {
  /** Clé de la paire (`départ>arrivée`), partagée avec la tuile pour le survol. */
  key: string;
  /** Variable CSS de la couleur (du trajet, ou verte pour une randonnée). */
  color: string;
  dashed: boolean;
  /** [lng, lat], ordre GeoJSON. */
  coordinates: [number, number][];
}

/** Tracés des trajets existants du jour ; sans géométrie, ligne droite entre les deux points. */
export function dayLegLines(items: readonly TimelineItem[], legs: readonly Leg[]): LegLine[] {
  const pairs = dayPairs(items, legs);
  const lines: LegLine[] = [];
  for (const r of requiredLegs(items)) {
    const key = legPairKey(r.fromKey, r.toKey);
    const pair = pairs.get(r.fromKey);
    const leg = pair?.leg;
    if (!leg) continue;
    const points = leg.geometry ? decodePolyline(leg.geometry) : [r.from, r.to];
    lines.push({
      key,
      color: pair.color!,
      dashed: leg.mode === 'walk',
      coordinates: points.map((p) => [p.lng, p.lat]),
    });
  }
  return lines;
}

/** Tracés GPX des randonnées du jour (vert), clé = identifiant de l'étape. */
export function dayHikeLines(items: readonly TimelineItem[]): LegLine[] {
  const steps = items.flatMap((i) =>
    i.kind === 'step' ? [i.step] : i.kind === 'group' ? i.children : [],
  );
  return steps
    .filter((s) => s.gpx !== null)
    .map((s) => ({
      key: s.id,
      color: '--type-hike',
      dashed: false,
      coordinates: s.gpx!.track.map(([lat, lng]) => [lng, lat] as [number, number]),
    }));
}
