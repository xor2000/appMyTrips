import {
  POI_TILE_ZOOM,
  pointInBbox,
  tileBbox,
  tilesForBbox,
  type Bbox,
  type Poi,
} from '@mytrips/core';
import type { MapStyleId } from './styles';

/**
 * Lieux dessinés par le fond « Plan OSM France ». Ses tuiles sont des images : elles ne disent pas
 * quel lieu se trouve sous le clic. On cherche donc, autour du clic, les lieux de la découverte
 * (mêmes catégories, même route `/api/poi` et même cache par case du zoom 13), et la carte ouvre
 * la popup du plus proche.
 */

/** Zoom à partir duquel le fond dessine assez de lieux pour qu'un clic en vise un. */
export const BASEMAP_POI_MIN_ZOOM = 15;

/** Marge autour du clic (px) : une icône du fond (ou le début de son nom) suffit. */
export const BASEMAP_POI_TOLERANCE_PX = 18;

export function basemapPoisClickable(styleId: MapStyleId, zoom: number): boolean {
  return styleId === 'osmfr' && zoom >= BASEMAP_POI_MIN_ZOOM;
}

/** Recherche des lieux d'une zone (une case du cache), au zoom de la carte. */
export type FetchPoiArea = (area: Bbox, zoom: number) => Promise<Poi[]>;

/**
 * Recherche des lieux sous un clic : chaque case du zoom 13 touchée par la zone du clic est
 * demandée une seule fois (requête en cours partagée, résultat gardé) ; une erreur n'est pas
 * gardée. Renvoie les lieux situés dans la zone du clic.
 */
export function createBasemapPoiFinder(fetchArea: FetchPoiArea) {
  const tiles = new Map<string, Promise<Poi[]>>();

  function tilePois(x: number, y: number, zoom: number): Promise<Poi[]> {
    const key = `${x}:${y}`;
    let request = tiles.get(key);
    if (!request) {
      request = fetchArea(tileBbox(x, y, POI_TILE_ZOOM), zoom);
      tiles.set(key, request);
      request.catch(() => tiles.delete(key));
    }
    return request;
  }

  return async (area: Bbox, zoom: number): Promise<Poi[]> => {
    const found = await Promise.all(
      tilesForBbox(area, POI_TILE_ZOOM).map((t) => tilePois(t.x, t.y, zoom)),
    );
    return found.flat().filter((p) => pointInBbox(p, area));
  };
}
