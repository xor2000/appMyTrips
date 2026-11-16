import {
  decodePolyline,
  encodePolyline,
  haversineM,
  localRoute,
  type LatLng,
  type LegMode,
  type RouteResult,
} from '@mytrips/core';
import type { Bindings } from '../env';

const DEFAULT_ORS_URL = 'https://api.heigit.org/openrouteservice';
const DEFAULT_TRANSITOUS_URL = 'https://api.transitous.org';
const TIMEOUT_MS = 10_000;
/** Au-delà, le tracé est allégé (un point sur n) : il ne sert qu'à l'affichage. */
const MAX_POINTS = 600;

const ORS_PROFILES: Partial<Record<LegMode, string>> = {
  car: 'driving-car',
  bike: 'cycling-regular',
  walk: 'foot-walking',
};

/** Aucun itinéraire n'existe (pas de route, pas de transport en commun). */
export class NoRouteError extends Error {}

/**
 * User-Agent du routage. Transitous demande le nom, la version et un moyen de contact :
 * `CONTACT_URL` (URL du projet), sans donnée personnelle par défaut.
 */
export function routingUserAgent(env: Bindings) {
  return env.CONTACT_URL
    ? `MyTrips/0.1 (+${env.CONTACT_URL})`
    : 'MyTrips/0.1 (application personnelle de carnet de voyage)';
}

function thin(points: LatLng[]): LatLng[] {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  const kept = points.filter((_, i) => i % step === 0);
  if (kept[kept.length - 1] !== points[points.length - 1]) kept.push(points[points.length - 1]!);
  return kept;
}

function pathLengthM(points: readonly LatLng[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineM(points[i - 1]!, points[i]!);
  return total;
}

async function orsRoute(
  env: Bindings,
  fetchImpl: typeof fetch,
  profile: string,
  from: LatLng,
  to: LatLng,
): Promise<RouteResult> {
  const base = (env.ORS_URL ?? DEFAULT_ORS_URL).replace(/\/+$/, '');
  const res = await fetchImpl(`${base}/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      authorization: env.ORS_API_KEY ?? '',
      'content-type': 'application/json',
      accept: 'application/json, application/geo+json',
      'user-agent': routingUserAgent(env),
    },
    body: JSON.stringify({
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // ORS répond 404 quand aucun itinéraire n'existe (point non routable, île…).
  if (res.status === 404) throw new NoRouteError();
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const body = (await res.json()) as {
    features?: {
      properties?: { summary?: { distance?: number; duration?: number } };
      geometry?: { coordinates?: [number, number][] };
    }[];
  };
  const feature = body.features?.[0];
  const summary = feature?.properties?.summary;
  if (!feature || typeof summary?.duration !== 'number') throw new NoRouteError();
  const points = (feature.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }));
  return {
    distanceM: Math.round(summary.distance ?? pathLengthM(points)),
    durationMin: Math.max(1, Math.round(summary.duration / 60)),
    geometry: encodePolyline(thin(points)),
    summary: null,
    source: 'router',
  };
}

interface TransitLeg {
  mode?: string;
  distance?: number;
  displayName?: string;
  routeShortName?: string;
  legGeometry?: { points?: string; precision?: number };
}

interface Itinerary {
  duration?: number;
  transfers?: number;
  legs?: TransitLeg[];
}

async function transitousRoute(
  env: Bindings,
  fetchImpl: typeof fetch,
  from: LatLng,
  to: LatLng,
  departAt: string | undefined,
): Promise<RouteResult> {
  // Concaténation (et non new URL(chemin, base)) : une base avec chemin, ex. un relais, est gardée.
  const base = (env.TRANSITOUS_URL ?? DEFAULT_TRANSITOUS_URL).replace(/\/+$/, '');
  const url = new URL(`${base}/api/v5/plan`);
  url.searchParams.set('fromPlace', `${from.lat},${from.lng}`);
  url.searchParams.set('toPlace', `${to.lat},${to.lng}`);
  if (departAt) url.searchParams.set('time', departAt);
  const res = await fetchImpl(url.toString(), {
    headers: { accept: 'application/json', 'user-agent': routingUserAgent(env) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Transitous ${res.status}`);
  const body = (await res.json()) as { itineraries?: Itinerary[] };
  // Le plus court, puis le moins de correspondances.
  const best = [...(body.itineraries ?? [])]
    .filter((i) => typeof i.duration === 'number' && Array.isArray(i.legs))
    .sort((a, b) => a.duration! - b.duration! || (a.transfers ?? 0) - (b.transfers ?? 0))[0];
  if (!best) throw new NoRouteError();
  const points: LatLng[] = [];
  let distance = 0;
  const lines: string[] = [];
  for (const leg of best.legs!) {
    const decoded = leg.legGeometry?.points
      ? decodePolyline(leg.legGeometry.points, leg.legGeometry.precision ?? 6)
      : [];
    points.push(...decoded);
    distance += typeof leg.distance === 'number' ? leg.distance : pathLengthM(decoded);
    const name = (leg.displayName || leg.routeShortName || '').trim();
    if (leg.mode && leg.mode !== 'WALK' && name) lines.push(name);
  }
  return {
    distanceM: Math.round(distance),
    durationMin: Math.max(1, Math.round(best.duration! / 60)),
    geometry: encodePolyline(thin(points.length > 1 ? points : [from, to])),
    summary: lines.length > 0 ? lines.join(' → ') : null,
    source: 'router',
  };
}

/**
 * Itinéraire d'un mode :
 * - voiture, vélo, marche : OpenRouteService ; sans clé ou en erreur, estimation locale ;
 * - bus, train : Transitous ; en erreur, estimation locale ;
 * - avion, ferry : calcul local.
 * Lève NoRouteError quand le fournisseur répond qu'aucun itinéraire n'existe.
 */
export async function computeRoute(
  env: Bindings,
  fetchImpl: typeof fetch,
  mode: LegMode,
  from: LatLng,
  to: LatLng,
  departAt?: string,
): Promise<RouteResult> {
  const profile = ORS_PROFILES[mode];
  try {
    if (profile) {
      if (!env.ORS_API_KEY) return localRoute(mode, from, to);
      return await orsRoute(env, fetchImpl, profile, from, to);
    }
    if (mode === 'bus' || mode === 'train') {
      return await transitousRoute(env, fetchImpl, from, to, departAt);
    }
    return localRoute(mode, from, to);
  } catch (e) {
    if (e instanceof NoRouteError) throw e;
    console.warn(`routage : estimation locale (${mode}, ${e instanceof Error ? e.message : e})`);
    return localRoute(mode, from, to);
  }
}

/** Le cache ne garde que les calculs de fournisseurs (une estimation est recalculée à chaque fois). */
export function isCacheable(mode: LegMode, route: RouteResult) {
  return route.source === 'router' && mode !== 'plane' && mode !== 'ferry';
}
