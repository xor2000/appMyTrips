import { POI_CATEGORIES, type Poi, type PoiCategory } from '@mytrips/core';
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

/**
 * Lieux groupés par catégorie, dans l'ordre des catégories de la découverte (`POI_CATEGORIES`),
 * sans groupe vide ; dans un groupe, l'ordre reçu (classement de l'API) est gardé.
 */
export function groupPoisByCategory(
  pois: readonly Poi[],
): { category: PoiCategory; pois: Poi[] }[] {
  return POI_CATEGORIES.map((category) => ({
    category,
    pois: pois.filter((p) => p.category === category),
  })).filter((g) => g.pois.length > 0);
}

/** Nombre de lieux par catégorie. */
export function poiCounts(pois: readonly Poi[]): Map<PoiCategory, number> {
  const counts = new Map<PoiCategory, number>();
  for (const p of pois) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return counts;
}

/**
 * Même vue de carte, pour la recherche : zoom à moins d'un demi-niveau, centre décalé de moins de
 * 15 % de la zone. Un léger redimensionnement (barre de défilement) ne compte pas comme un
 * déplacement : il ne doit pas reproposer « Rechercher dans cette zone ».
 */
export function sameView(a: MapView, b: MapView | null): boolean {
  if (!b) return false;
  if (Math.abs(a.zoom - b.zoom) >= 0.5) return false;
  const width = a.bbox.east - a.bbox.west;
  const height = a.bbox.north - a.bbox.south;
  const dx = Math.abs((a.bbox.west + a.bbox.east) / 2 - (b.bbox.west + b.bbox.east) / 2);
  const dy = Math.abs((a.bbox.south + a.bbox.north) / 2 - (b.bbox.south + b.bbox.north) / 2);
  return dx <= width * 0.15 && dy <= height * 0.15;
}
