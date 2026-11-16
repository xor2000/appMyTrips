import type { LatLng } from '../step/timeline';
import { encodePolyline, greatCircleArc, haversineM } from './geo';

/** Modes de transport, dans l'ordre des raccourcis. */
export const LEG_MODES = ['car', 'bike', 'walk', 'bus', 'train', 'plane', 'ferry'] as const;
export type LegMode = (typeof LEG_MODES)[number];

/** Origine d'une valeur de trajet : routeur, estimation locale ou saisie. */
export type LegValueSource = 'router' | 'estimate' | 'manual';

export interface LegModeInfo {
  label: string;
  /** Vitesse moyenne (km/h) pour une durée déduite d'une distance. */
  speedKmh: number;
  /** Variable CSS de la couleur du tracé. */
  color: string;
}

export const LEG_MODE_INFO: Record<LegMode, LegModeInfo> = {
  car: { label: 'Voiture', speedKmh: 60, color: '--type-transport' },
  bike: { label: 'Vélo', speedKmh: 15, color: '--type-hike' },
  walk: { label: 'Marche', speedKmh: 4.5, color: '--type-hike' },
  bus: { label: 'Bus', speedKmh: 30, color: '--type-food' },
  train: { label: 'Train', speedKmh: 80, color: '--type-museum' },
  plane: { label: 'Avion', speedKmh: 750, color: '--type-air' },
  ferry: { label: 'Ferry', speedKmh: 30, color: '--type-air' },
};

/** Temps d'enregistrement et d'embarquement ajouté à un vol. */
const PLANE_OVERHEAD_MIN = 30;
/** Détour moyen de la route par rapport au grand cercle, pour une estimation. */
const DETOUR = 1.3;

/** Durée (minutes, au moins 1) d'une distance parcourue à la vitesse moyenne du mode. */
export function durationAtSpeed(mode: LegMode, distanceM: number): number {
  return Math.max(1, Math.round((distanceM / 1000 / LEG_MODE_INFO[mode].speedKmh) * 60));
}

/** Résultat d'un calcul d'itinéraire. */
export interface RouteResult {
  distanceM: number;
  durationMin: number;
  /** Polyligne encodée, précision 5. */
  geometry: string;
  /** Lignes empruntées (bus, train), ex. « TER 17611 → Bus 3 ». */
  summary: string | null;
  source: 'router' | 'estimate';
}

/**
 * Calcul sans service externe. Avion : grand cercle, 750 km/h + 30 min, tracé en arc. Ferry :
 * grand cercle à 30 km/h. Autres modes : estimation (grand cercle × 1,3) en ligne droite.
 */
export function localRoute(mode: LegMode, from: LatLng, to: LatLng): RouteResult {
  const gc = haversineM(from, to);
  if (mode === 'plane' || mode === 'ferry') {
    const distanceM = Math.round(gc);
    const durationMin =
      mode === 'plane'
        ? Math.round((gc / 1000 / LEG_MODE_INFO.plane.speedKmh) * 60) + PLANE_OVERHEAD_MIN
        : durationAtSpeed('ferry', distanceM);
    return {
      distanceM,
      durationMin,
      geometry: encodePolyline(greatCircleArc(from, to, 48)),
      summary: null,
      source: 'router',
    };
  }
  const distanceM = Math.round(gc * DETOUR);
  return {
    distanceM,
    durationMin: durationAtSpeed(mode, distanceM),
    geometry: encodePolyline([from, to]),
    summary: null,
    source: 'estimate',
  };
}

export interface LegValues {
  distanceM: number | null;
  durationMin: number;
  distanceSource: LegValueSource;
  durationSource: LegValueSource;
}

/**
 * Valeurs d'un trajet : la durée saisie est toujours gardée ; une distance saisie sans durée donne
 * une durée à la vitesse du mode ; sinon les valeurs du calcul. null si rien ne permet une durée.
 */
export function legValues(
  mode: LegMode,
  routed: Pick<RouteResult, 'distanceM' | 'durationMin' | 'source'> | null,
  manual: { distanceM?: number | null; durationMin?: number | null },
): LegValues | null {
  const manualDistance = manual.distanceM ?? null;
  const manualDuration = manual.durationMin ?? null;
  const distance =
    manualDistance !== null
      ? { value: manualDistance, source: 'manual' as const }
      : routed
        ? { value: routed.distanceM, source: routed.source }
        : { value: null, source: 'manual' as const };
  let duration: { value: number; source: LegValueSource } | null = null;
  if (manualDuration !== null) duration = { value: manualDuration, source: 'manual' };
  else if (manualDistance !== null) {
    duration = { value: durationAtSpeed(mode, manualDistance), source: 'manual' };
  } else if (routed) duration = { value: routed.durationMin, source: routed.source };
  if (!duration) return null;
  return {
    distanceM: distance.value,
    durationMin: duration.value,
    distanceSource: distance.source,
    durationSource: duration.source,
  };
}
