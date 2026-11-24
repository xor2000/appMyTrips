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

const DEFAULT_OSRM_URL = 'https://routing.openstreetmap.de';
const DEFAULT_TRANSITOUS_URL = 'https://api.transitous.org';
const TIMEOUT_MS = 10_000;

/**
 * Serveurs OSRM de FOSSGIS : un serveur par profil (le profil écrit dans le chemin de l'API,
 * `driving`, est ignoré par ces serveurs).
 */
const OSRM_PROFILES: Partial<Record<LegMode, string>> = {
  car: 'routed-car',
  bike: 'routed-bike',
  walk: 'routed-foot',
};

/** Codes OSRM qui veulent dire « aucun itinéraire » (point non routable, île…). */
const OSRM_NO_ROUTE = new Set(['NoRoute', 'NoSegment']);

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

function pathLengthM(points: readonly LatLng[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineM(points[i - 1]!, points[i]!);
  return total;
}

async function osrmRoute(
  env: Bindings,
  fetchImpl: typeof fetch,
  server: string,
  from: LatLng,
  to: LatLng,
): Promise<RouteResult> {
  // Concaténation (et non new URL(chemin, base)) : une base avec chemin, ex. un relais, est gardée.
  const base = (env.OSRM_URL ?? DEFAULT_OSRM_URL).replace(/\/+$/, '');
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  // Tracé complet (`overview=full`) en polyligne de précision 5, le format des trajets enregistrés :
  // gardé tel quel, sans allègement ni décodage (peu de CPU pour le Worker), comme la référence.
  const res = await fetchImpl(
    `${base}/${server}/route/v1/driving/${coords}?overview=full&geometries=polyline`,
    {
      headers: { accept: 'application/json', 'user-agent': routingUserAgent(env) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    routes?: { distance?: number; duration?: number; geometry?: string }[];
  };
  // OSRM répond 400 avec `code: NoRoute` ou `NoSegment` quand aucun itinéraire n'existe.
  if (body.code && OSRM_NO_ROUTE.has(body.code)) throw new NoRouteError();
  if (!res.ok || body.code !== 'Ok') throw new Error(`OSRM ${res.status} ${body.code ?? ''}`);
  const route = body.routes?.[0];
  if (!route || typeof route.duration !== 'number') throw new NoRouteError();
  const geometry = route.geometry || encodePolyline([from, to]);
  return {
    distanceM: Math.round(route.distance ?? pathLengthM(decodePolyline(geometry))),
    durationMin: Math.max(1, Math.round(route.duration / 60)),
    geometry,
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
    geometry: encodePolyline(points.length > 1 ? points : [from, to]),
    summary: lines.length > 0 ? lines.join(' → ') : null,
    source: 'router',
  };
}

/**
 * Itinéraire d'un mode :
 * - voiture, vélo, marche : OSRM (serveurs de FOSSGIS) ; en erreur, estimation locale ;
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
  const server = OSRM_PROFILES[mode];
  try {
    if (server) return await osrmRoute(env, fetchImpl, server, from, to);
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
