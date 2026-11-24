import type { Poi, StepType } from '@mytrips/core';
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';

/**
 * Lieux de la découverte dessinés par la carte (WebGL) plutôt qu'en marqueurs HTML : ils suivent
 * exactement les déplacements de la carte, même nombreux. Le lieu survolé ou sélectionné porte
 * l'état `active` (`setFeatureState`), sans recréer la couche.
 */
export const POI_SOURCE = 'pois';
export const POI_LAYER = 'pois';
/** Icônes des types, posées au centre des pastilles (images ajoutées par la carte). */
export const POI_ICON_LAYER = 'poi-icons';

/** Identifiant de l'image de l'icône d'un type d'étape (voir `lib/map/poiIcons.ts`). */
export function poiIconId(type: StepType): string {
  return `poi-icon-${type}`;
}

export interface PoiFeatureProperties {
  id: string;
  name: string;
  /** Couleur réelle du type d'étape (MapLibre ne lit pas les variables CSS). */
  color: string;
  /** Image de l'icône du type (`poiIconId`). */
  icon: string;
}

export interface PoiFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: PoiFeatureProperties;
  }[];
}

export function poiFeatureCollection(
  pois: readonly Poi[],
  colorOf: (poi: Poi) => string,
): PoiFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pois.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, color: colorOf(p), icon: poiIconId(p.stepType) },
    })),
  };
}

const active: ExpressionSpecification = ['boolean', ['feature-state', 'active'], false];

/**
 * Pastilles colorées par type, cerclées de `ringColor`, assez grandes pour leur icône ; plus
 * grandes quand le lieu est actif.
 */
export function poiLayer(ringColor: string): CircleLayerSpecification {
  return {
    id: POI_LAYER,
    type: 'circle',
    source: POI_SOURCE,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['case', active, 15, 11],
      'circle-opacity': ['case', active, 1, 0.85],
      'circle-stroke-color': ringColor,
      'circle-stroke-width': ['case', active, 3, 2],
    },
  };
}

/**
 * Icône blanche du type au centre de chaque pastille. Toujours affichée (pas de collision entre
 * icônes) ; le clic et le survol restent sur la couche des pastilles.
 */
export function poiIconLayer(): SymbolLayerSpecification {
  return {
    id: POI_ICON_LAYER,
    type: 'symbol',
    source: POI_SOURCE,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': ['case', active, 1, 0.9] },
  };
}

/** Marge autour du clic (px) : une pastille se touche sans viser au pixel près. */
export const POI_HIT_TOLERANCE_PX = 8;

/** Lieu le plus proche du clic parmi ceux trouvés sous le curseur, ou null. */
export function closestPoiId(
  hits: readonly { id: string; lng: number; lat: number }[],
  point: { x: number; y: number },
  project: (lngLat: [number, number]) => { x: number; y: number },
): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const hit of hits) {
    const p = project([hit.lng, hit.lat]);
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (!best || distance < best.distance) best = { id: hit.id, distance };
  }
  return best?.id ?? null;
}
