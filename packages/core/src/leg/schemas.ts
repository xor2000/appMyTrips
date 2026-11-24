import { z } from 'zod';
import { TimeOfDay } from '../trip/schemas';
import { LEG_COLOR_COUNT } from './colors';
import { LEG_MODES, type LegMode, type LegValueSource } from './modes';

export const LegModeSchema = z.enum(LEG_MODES);

/** Clé d'étape (UUID) ou d'occurrence de séjour (`stay:<id>:<date>:start|end`). */
const PointKey = z.string().min(1).max(120);
const Distance = z.number().int().min(0).max(40_000_000);
const Duration = z
  .number()
  .int()
  .min(1)
  .max(7 * 24 * 60);
/** Rang de la couleur dans la palette des trajets. */
const Color = z
  .number()
  .int()
  .min(0)
  .max(LEG_COLOR_COUNT - 1);
const Point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Création (ou remplacement) du trajet d'une paire ; distance et durée facultatives = routeur. */
export const LegCreate = z
  .object({
    fromKey: PointKey,
    toKey: PointKey,
    mode: LegModeSchema,
    distanceM: Distance.optional(),
    durationMin: Duration.optional(),
    /** Heure de départ fixée (train réservé…). */
    departAt: TimeOfDay.optional(),
    bookingRef: z.string().max(200).optional(),
    /** Couleur choisie ; absente : automatique. */
    color: Color.optional(),
    notes: z.string().max(5000).default(''),
  })
  .refine((v) => v.fromKey !== v.toKey, {
    message: 'Départ et arrivée identiques',
    path: ['toKey'],
  });
export type LegCreate = z.infer<typeof LegCreate>;

/**
 * Modification d'un trajet : null remet distance ou durée au routeur (la couleur en automatique) ;
 * `recompute` relance le calcul.
 */
export const LegPatch = z
  .object({
    mode: LegModeSchema,
    distanceM: Distance.nullable(),
    durationMin: Duration.nullable(),
    departAt: TimeOfDay.nullable(),
    bookingRef: z.string().max(200).nullable(),
    color: Color.nullable(),
    notes: z.string().max(5000),
    recompute: z.literal(true),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification');
export type LegPatch = z.infer<typeof LegPatch>;

/** Demande de calcul d'itinéraire (POST /api/route). */
export const RouteRequest = z.object({
  mode: LegModeSchema,
  from: Point,
  to: Point,
  /** Instant de départ (bus, train). */
  departAt: z.iso.datetime().optional(),
});
export type RouteRequest = z.infer<typeof RouteRequest>;

/** Trajet tel que renvoyé par l'API. */
export interface Leg {
  id: string;
  fromKey: string;
  toKey: string;
  mode: LegMode;
  distanceM: number | null;
  durationMin: number;
  distanceSource: LegValueSource;
  durationSource: LegValueSource;
  /** Polyligne encodée (précision 5), ou null sans tracé. */
  geometry: string | null;
  summary: string | null;
  departAt: string | null;
  bookingRef: string | null;
  /** Couleur choisie (rang dans la palette), ou null : automatique (voir `dayLegColors`). */
  color: number | null;
  notes: string;
  computedAt: string | null;
}

/** Instant UTC (ISO) d'une heure locale dans un fuseau IANA ; UTC si le fuseau est inconnu. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): string {
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  let offsetMs: number;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(asUtc));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const local = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    offsetMs = local - asUtc;
  } catch {
    offsetMs = 0;
  }
  return new Date(asUtc - offsetMs).toISOString();
}

/**
 * Heure de départ estimée d'un trajet (en attendant le moteur d'horaires) : heure fixée du
 * trajet, sinon fin de l'étape précédente si elle a une heure fixe (bornée à 23:59), sinon 09:00.
 */
export function estimatedDeparture(
  leg: { departAt: string | null },
  previous: { fixedStart: string | null; durationMin: number } | null,
): string {
  if (leg.departAt) return leg.departAt;
  if (!previous?.fixedStart) return '09:00';
  const [h, m] = previous.fixedStart.split(':').map(Number) as [number, number];
  const end = Math.min(h * 60 + m + previous.durationMin, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
