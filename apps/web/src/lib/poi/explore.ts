import type { Poi, PoiCategory } from '@mytrips/core';
import type { MapView, StepInput } from '#lib/api.ts';

/** Longueur maximale des horaires dans le schéma d'étape. */
const MAX_OPENING_HOURS = 500;

/** Étape pré-remplie depuis un lieu découvert (jour, ou null pour les idées). */
export function poiStepInput(poi: Poi, dayId: string | null): StepInput {
  const notes = [
    poi.website && `Site : ${poi.website}`,
    poi.phone && `Tél. : ${poi.phone}`,
    poi.cuisine && `Cuisine : ${poi.cuisine.split(';').join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
  return {
    dayId,
    type: poi.stepType,
    name: poi.name.slice(0, 200),
    lat: poi.lat,
    lng: poi.lng,
    address: poi.address,
    openingHours: poi.openingHours?.slice(0, MAX_OPENING_HOURS) ?? null,
    osmRef: poi.osmRef,
    notes,
  };
}

/** Nombre de lieux par catégorie. */
export function poiCounts(pois: readonly Poi[]): Map<PoiCategory, number> {
  const counts = new Map<PoiCategory, number>();
  for (const p of pois) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return counts;
}

/** Deux vues de carte identiques, à l'arrondi près (la carte renvoie des flottants). */
export function sameView(a: MapView, b: MapView | null): boolean {
  if (!b) return false;
  const close = (x: number, y: number) => Math.abs(x - y) < 1e-5;
  return (
    close(a.zoom, b.zoom) &&
    close(a.bbox.west, b.bbox.west) &&
    close(a.bbox.south, b.bbox.south) &&
    close(a.bbox.east, b.bbox.east) &&
    close(a.bbox.north, b.bbox.north)
  );
}
