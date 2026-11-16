import { decodePolyline } from '../leg/geo';
import { tileOf, type Bbox } from '../poi/tiles';
import type { LatLng } from '../step/timeline';
import type { TripSnapshot } from '../trip/schemas';

/** Tuile de carte (schéma « slippy map »). */
export interface ZTile {
  z: number;
  x: number;
  y: number;
}

/** Zooms préchargés pour la consultation hors ligne (OpenFreeMap s'arrête au zoom 14). */
export const OFFLINE_MIN_ZOOM = 6;
export const OFFLINE_MAX_ZOOM = 14;
/** Plafond de tuiles par voyage (respect d'OpenFreeMap, espace du navigateur). */
export const OFFLINE_MAX_TILES = 4000;
/** Taille moyenne d'une tuile vectorielle, pour l'estimation. */
const AVERAGE_TILE_BYTES = 25_000;
/** Marge minimale autour d'un point isolé (degrés). */
const MIN_SPAN = 0.01;

/** Tuiles d'une emprise à un zoom ; une emprise qui franchit l'antiméridien (ouest > est) est coupée. */
export function tilesInBbox(bbox: Bbox, z: number): ZTile[] {
  if (bbox.west > bbox.east) {
    return [...tilesInBbox({ ...bbox, east: 180 }, z), ...tilesInBbox({ ...bbox, west: -180 }, z)];
  }
  const nw = tileOf(bbox.north, bbox.west, z);
  const se = tileOf(bbox.south, bbox.east, z);
  const tiles: ZTile[] = [];
  for (let x = nw.x; x <= se.x; x++) for (let y = nw.y; y <= se.y; y++) tiles.push({ z, x, y });
  return tiles;
}

/** Emprise agrandie de 10 % de chaque côté (au moins `MIN_SPAN` pour un point isolé). */
export function padBbox(bbox: Bbox, ratio = 0.1): Bbox {
  const dx =
    Math.max(bbox.east - bbox.west, MIN_SPAN) * ratio +
    (bbox.east === bbox.west ? MIN_SPAN / 2 : 0);
  const dy =
    Math.max(bbox.north - bbox.south, MIN_SPAN) * ratio +
    (bbox.north === bbox.south ? MIN_SPAN / 2 : 0);
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    west: round(Math.max(-180, bbox.west - dx)),
    south: round(Math.max(-85, bbox.south - dy)),
    east: round(Math.min(180, bbox.east + dx)),
    north: round(Math.min(85, bbox.north + dy)),
  };
}

function bboxOf(points: readonly LatLng[]): Bbox | null {
  if (points.length === 0) return null;
  return {
    west: Math.min(...points.map((p) => p.lng)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    north: Math.max(...points.map((p) => p.lat)),
  };
}

/**
 * Emprise de chaque jour du voyage (avec marge) : étapes et leurs sorties, tracés GPX, tracés des
 * trajets, séjours qui couvrent la nuit précédente ou suivante. Les idées ne comptent pas.
 */
export function tripBboxes(
  snapshot: Pick<TripSnapshot, 'days' | 'steps' | 'stays' | 'legs'>,
): Bbox[] {
  const boxes: Bbox[] = [];
  for (const day of snapshot.days) {
    const steps = snapshot.steps.filter((s) => s.dayId === day.id);
    const ids = new Set(steps.map((s) => s.id));
    const points: LatLng[] = [];
    for (const s of steps) {
      if (s.lat !== null && s.lng !== null) points.push({ lat: s.lat, lng: s.lng });
      if (s.exitLat !== null && s.exitLng !== null) points.push({ lat: s.exitLat, lng: s.exitLng });
      for (const [lat, lng] of s.gpx?.track ?? []) points.push({ lat, lng });
    }
    for (const stay of snapshot.stays) {
      if (stay.checkInDate <= day.date && day.date <= stay.checkOutDate) {
        points.push({ lat: stay.lat, lng: stay.lng });
      }
    }
    for (const leg of snapshot.legs) {
      if (leg.geometry && (ids.has(leg.fromKey) || ids.has(leg.toKey))) {
        points.push(...decodePolyline(leg.geometry));
      }
    }
    const box = bboxOf(points);
    if (box) boxes.push(padBbox(box));
  }
  return boxes;
}

/**
 * Tuiles à précharger pour des emprises (zooms 6 à 14, sans doublon). Au-delà du plafond, le zoom
 * maximal est abaissé jusqu'à rester sous la limite.
 */
export function planOfflineTiles(
  bboxes: readonly Bbox[],
  limit = OFFLINE_MAX_TILES,
): { tiles: ZTile[]; maxZoom: number; reduced: boolean } {
  if (bboxes.length === 0) return { tiles: [], maxZoom: OFFLINE_MAX_ZOOM, reduced: false };
  for (let maxZoom = OFFLINE_MAX_ZOOM; maxZoom >= OFFLINE_MIN_ZOOM; maxZoom--) {
    const seen = new Map<string, ZTile>();
    for (let z = OFFLINE_MIN_ZOOM; z <= maxZoom; z++) {
      for (const box of bboxes) {
        for (const t of tilesInBbox(box, z)) seen.set(`${t.z}/${t.x}/${t.y}`, t);
      }
      if (seen.size > limit) break;
    }
    if (seen.size <= limit) {
      return { tiles: [...seen.values()], maxZoom, reduced: maxZoom < OFFLINE_MAX_ZOOM };
    }
  }
  return { tiles: [], maxZoom: OFFLINE_MIN_ZOOM, reduced: true };
}

/** Estimation de l'espace occupé par des tuiles. */
export function estimateTileBytes(count: number): number {
  return count * AVERAGE_TILE_BYTES;
}
