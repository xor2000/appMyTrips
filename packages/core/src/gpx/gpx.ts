import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import { haversineM } from '../leg/geo';

/** Taille maximale d'un fichier GPX importé. */
export const GPX_MAX_BYTES = 10 * 1024 * 1024;
/** Nombre maximal de points du tracé simplifié (stocké et affiché). */
export const GPX_TRACK_MAX = 500;
/** Départ et arrivée à moins de 200 m : une boucle. */
const LOOP_MAX_M = 200;
/** Lissage des altitudes : moyenne glissante sur 5 points, variations de moins de 3 m ignorées. */
const SMOOTH_WINDOW = 5;
const ELEVATION_THRESHOLD_M = 3;

export interface GpxPoint {
  lat: number;
  lng: number;
  ele: number | null;
}

export type GpxErrorCode = 'invalid_xml' | 'no_points' | 'too_few_points';

const MESSAGES: Record<GpxErrorCode, string> = {
  invalid_xml: 'Fichier GPX illisible (XML invalide).',
  no_points: 'Ce fichier GPX ne contient ni trace ni itinéraire.',
  too_few_points: 'Le tracé GPX doit compter au moins deux points.',
};

export class GpxError extends Error {
  constructor(readonly code: GpxErrorCode) {
    super(MESSAGES[code]);
    this.name = 'GpxError';
  }
}

type Node = Record<string, unknown>;
const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const text = (v: unknown): string | null => {
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim() || null;
  if (v && typeof v === 'object' && '#text' in v) return text((v as Node)['#text']);
  return null;
};

function toPoint(node: Node): GpxPoint | null {
  const lat = Number(node['@_lat']);
  const lng = Number(node['@_lon']);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  const ele = Number(text(node.ele));
  return { lat, lng, ele: text(node.ele) !== null && Number.isFinite(ele) ? ele : null };
}

/**
 * Lit un GPX : points des traces (`trk/trkseg/trkpt`, segments concaténés dans l'ordre), sinon
 * des itinéraires (`rte/rtept`). Nom : celui de la trace, sinon des métadonnées. Lève GpxError.
 */
export function parseGpx(xml: string): { name: string | null; points: GpxPoint[] } {
  if (!xml.trim() || XMLValidator.validate(xml) !== true) throw new GpxError('invalid_xml');
  const doc = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml) as Node;
  const root = doc.gpx as Node | undefined;
  if (!root || typeof root !== 'object') throw new GpxError('no_points');

  const tracks = asArray(root.trk as Node | Node[] | undefined);
  let points = tracks.flatMap((trk) =>
    asArray(trk.trkseg as Node | Node[] | undefined).flatMap((seg) =>
      asArray(seg.trkpt as Node | Node[] | undefined).map(toPoint),
    ),
  );
  let name = text(tracks[0]?.name);
  if (points.length === 0) {
    const routes = asArray(root.rte as Node | Node[] | undefined);
    points = routes.flatMap((rte) => asArray(rte.rtept as Node | Node[] | undefined).map(toPoint));
    name = text(routes[0]?.name);
  }
  const valid = points.filter((p): p is GpxPoint => p !== null);
  if (valid.length === 0) throw new GpxError('no_points');
  if (valid.length < 2) throw new GpxError('too_few_points');
  return { name: name ?? text((root.metadata as Node | undefined)?.name), points: valid };
}

export interface GpxStats {
  distanceM: number;
  /** null sans altitudes exploitables. */
  ascentM: number | null;
  descentM: number | null;
  minEle: number | null;
  maxEle: number | null;
  isLoop: boolean;
  pointCount: number;
}

/** D+ et D− sur des altitudes lissées, avec un seuil qui ignore le bruit. */
function elevationGain(elevations: number[]): { ascent: number; descent: number } {
  const half = Math.floor(SMOOTH_WINDOW / 2);
  const smooth = elevations.map((_, i) => {
    const slice = elevations.slice(Math.max(0, i - half), i + half + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  let ascent = 0;
  let descent = 0;
  let ref = smooth[0]!;
  for (const e of smooth) {
    const diff = e - ref;
    if (diff >= ELEVATION_THRESHOLD_M) {
      ascent += diff;
      ref = e;
    } else if (diff <= -ELEVATION_THRESHOLD_M) {
      descent -= diff;
      ref = e;
    }
  }
  return { ascent: Math.round(ascent), descent: Math.round(descent) };
}

/** Distance (haversine cumulée), D+ et D−, altitudes extrêmes, boucle. */
export function gpxStats(points: readonly GpxPoint[]): GpxStats {
  let distance = 0;
  for (let i = 1; i < points.length; i++) distance += haversineM(points[i - 1]!, points[i]!);
  const elevations = points.map((p) => p.ele).filter((e): e is number => e !== null);
  // Moins de la moitié des points avec une altitude : dénivelé inconnu.
  const hasEle = elevations.length >= points.length / 2 && elevations.length >= 2;
  const gain = hasEle ? elevationGain(elevations) : null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return {
    distanceM: Math.round(distance),
    ascentM: gain?.ascent ?? null,
    descentM: gain?.descent ?? null,
    minEle: hasEle ? Math.round(Math.min(...elevations)) : null,
    maxEle: hasEle ? Math.round(Math.max(...elevations)) : null,
    isLoop: haversineM(first, last) <= LOOP_MAX_M,
    pointCount: points.length,
  };
}

/**
 * Durée d'une randonnée : distance à la vitesse du voyage, plus 1 h par 600 m de D+ si demandé,
 * arrondie aux 5 min.
 */
export function hikeDurationMin(
  stats: { distanceM: number; ascentM: number | null },
  speedKmh: number,
  useElevation: boolean,
): number {
  let hours = stats.distanceM / 1000 / speedKmh;
  if (useElevation && stats.ascentM !== null) hours += stats.ascentM / 600;
  return Math.max(5, Math.round((hours * 60) / 5) * 5);
}

/** Distance (m) d'un point au segment [a, b], en projection locale (suffisant à cette échelle). */
function distanceToSegment(p: GpxPoint, a: GpxPoint, b: GpxPoint): number {
  const k = Math.cos((a.lat * Math.PI) / 180);
  const toXY = (q: GpxPoint) => [q.lng * k * 111_320, q.lat * 110_540] as const;
  const [px, py] = toXY(p);
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ramer–Douglas–Peucker (itératif) : indices gardés pour une tolérance donnée. */
function rdp(points: readonly GpxPoint[], epsilon: number): number[] {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxD = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegment(points[i]!, points[start]!, points[end]!);
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (index >= 0 && maxD > epsilon) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  const out: number[] = [];
  keep.forEach((k, i) => {
    if (k) out.push(i);
  });
  return out;
}

/** Tracé simplifié à `max` points au plus, départ et arrivée conservés. */
export function simplifyTrack(points: readonly GpxPoint[], max = GPX_TRACK_MAX): GpxPoint[] {
  if (points.length <= max) return [...points];
  let epsilon = 1;
  let kept = rdp(points, epsilon);
  while (kept.length > max) {
    epsilon *= 1.6;
    kept = rdp(points, epsilon);
  }
  return kept.map((i) => points[i]!);
}

const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-180).max(180);
const Meters = z.number().min(0).max(1_000_000);
const Ele = z.number().min(-500).max(9000);

/** Données GPX envoyées à l'API : statistiques et tracé simplifié `[lat, lng, ele|null]`. */
export const GpxData = z.object({
  stats: z.object({
    distanceM: Meters,
    ascentM: Meters.nullable(),
    descentM: Meters.nullable(),
    minEle: Ele.nullable(),
    maxEle: Ele.nullable(),
    isLoop: z.boolean(),
    pointCount: z.number().int().min(2).max(10_000_000),
  }),
  track: z
    .array(z.tuple([Lat, Lng, Ele.nullable()]))
    .min(2)
    .max(GPX_TRACK_MAX),
});
export type GpxData = z.infer<typeof GpxData>;

/** Lecture complète d'un fichier GPX côté navigateur : nom, statistiques et tracé simplifié. */
export function prepareGpx(xml: string): { name: string | null; gpx: GpxData } {
  const { name, points } = parseGpx(xml);
  const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    name,
    gpx: {
      stats: gpxStats(points),
      track: simplifyTrack(points).map((p) => [
        round(p.lat, 6),
        round(p.lng, 6),
        p.ele === null ? null : round(p.ele, 1),
      ]),
    },
  };
}

/** Profil altimétrique : distance cumulée et altitude ; vide sans altitudes. */
export function elevationProfile(track: GpxData['track']): { distanceM: number; ele: number }[] {
  if (track.some(([, , ele]) => ele === null)) return [];
  const profile: { distanceM: number; ele: number }[] = [];
  let d = 0;
  track.forEach(([lat, lng, ele], i) => {
    if (i > 0) {
      const [plat, plng] = track[i - 1]!;
      d += haversineM({ lat: plat, lng: plng }, { lat, lng });
    }
    profile.push({ distanceM: Math.round(d), ele: ele! });
  });
  return profile;
}
