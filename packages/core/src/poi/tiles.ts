/** Zone géographique (degrés). */
export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Tile {
  x: number;
  y: number;
}

/** Zoom de carte minimal pour explorer. */
export const POI_MIN_ZOOM = 12;
/**
 * Zoom des cases du cache. Au zoom 12 de MapLibre (tuiles de 512 px), une case du zoom 13 fait
 * 256 px : la zone visible tient en une vingtaine de cases.
 */
export const POI_TILE_ZOOM = 13;
/** Nombre maximal de cases par recherche ; au-delà, il faut zoomer. */
export const POI_MAX_TILES = 40;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Case (schéma « slippy map ») qui contient le point. */
export function tileOf(lat: number, lng: number, zoom: number): Tile {
  const n = 2 ** zoom;
  const clampLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const r = toRad(clampLat);
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

/** Zone couverte par une case. */
export function tileBbox(x: number, y: number, zoom: number): Bbox {
  const n = 2 ** zoom;
  const lat = (yy: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  return {
    west: (x / n) * 360 - 180,
    east: ((x + 1) / n) * 360 - 180,
    north: lat(y),
    south: lat(y + 1),
  };
}

/** Cases qui touchent la zone. */
export function tilesForBbox(bbox: Bbox, zoom: number): Tile[] {
  const nw = tileOf(bbox.north, bbox.west, zoom);
  const se = tileOf(bbox.south, bbox.east, zoom);
  const tiles: Tile[] = [];
  for (let x = nw.x; x <= se.x; x++) for (let y = nw.y; y <= se.y; y++) tiles.push({ x, y });
  return tiles;
}

export function pointInBbox(p: { lat: number; lng: number }, b: Bbox): boolean {
  return p.lng >= b.west && p.lng <= b.east && p.lat >= b.south && p.lat <= b.north;
}

export function bboxCenter(b: Bbox): { lat: number; lng: number } {
  return { lat: (b.south + b.north) / 2, lng: (b.west + b.east) / 2 };
}

/** Plus petite zone qui contient toutes les zones données. */
export function unionBbox(boxes: readonly Bbox[]): Bbox {
  return {
    west: Math.min(...boxes.map((b) => b.west)),
    south: Math.min(...boxes.map((b) => b.south)),
    east: Math.max(...boxes.map((b) => b.east)),
    north: Math.max(...boxes.map((b) => b.north)),
  };
}

/** Lit « ouest,sud,est,nord » ; null si invalide. */
export function parseBbox(value: string | undefined): Bbox | null {
  if (!value) return null;
  const parts = value.split(',').map((s) => (s.trim() === '' ? NaN : Number(s)));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts as [number, number, number, number];
  const lngOk = (v: number) => v >= -180 && v <= 180;
  const latOk = (v: number) => v >= -90 && v <= 90;
  if (![west, east].every(lngOk) || ![south, north].every(latOk)) return null;
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}
