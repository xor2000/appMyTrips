import type { Poi } from '@mytrips/core';
import type { CircleLayerSpecification, ExpressionSpecification } from 'maplibre-gl';

/**
 * Lieux de la découverte dessinés par la carte (WebGL) plutôt qu'en marqueurs HTML : ils suivent
 * exactement les déplacements de la carte, même nombreux. Le lieu survolé ou sélectionné porte
 * l'état `active` (`setFeatureState`), sans recréer la couche.
 */
export const POI_SOURCE = 'pois';
export const POI_LAYER = 'pois';

export interface PoiFeatureProperties {
  id: string;
  name: string;
  /** Couleur réelle du type d'étape (MapLibre ne lit pas les variables CSS). */
  color: string;
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
      properties: { id: p.id, name: p.name, color: colorOf(p) },
    })),
  };
}

const active: ExpressionSpecification = ['boolean', ['feature-state', 'active'], false];

/** Pastilles colorées par type, cerclées de `ringColor` ; plus grandes quand le lieu est actif. */
export function poiLayer(ringColor: string): CircleLayerSpecification {
  return {
    id: POI_LAYER,
    type: 'circle',
    source: POI_SOURCE,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['case', active, 10, 7],
      'circle-opacity': ['case', active, 1, 0.65],
      'circle-stroke-color': ringColor,
      'circle-stroke-width': ['case', active, 3, 2],
    },
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
