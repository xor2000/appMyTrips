import type { StyleSpecification } from 'maplibre-gl';

/** Fond de carte vectoriel OpenFreeMap (sans clé ; service fourni sans garantie). */
export const PLAN_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Fond topographique OpenTopoMap (tuiles raster), utile pour les randonnées. */
export const TOPO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    topo: {
      type: 'raster',
      tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      tileSize: 256,
      maxzoom: 17,
      attribution:
        'Carte : © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) · Données : © <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'topo', type: 'raster', source: 'topo' }],
};

export type MapStyleId = 'plan' | 'topo';

export function styleFor(id: MapStyleId): string | StyleSpecification {
  return id === 'plan' ? PLAN_STYLE_URL : TOPO_STYLE;
}
