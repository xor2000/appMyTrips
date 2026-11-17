import { z } from 'zod';
import type { Stay, Step } from '../step/schemas';
import type { Leg } from '../leg/schemas';
import { TripCover } from '../cover/cover';
import { toDayNumber } from './days';

/** Durée maximale d'un voyage, en jours. */
export const MAX_TRIP_DAYS = 90;

/** Date calendaire AAAA-MM-JJ qui existe réellement. */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Date inexistante');

/** Heure locale HH:mm (00:00 à 23:59). */
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format attendu : HH:mm');

/** Fuseau horaire IANA connu du moteur JavaScript. */
export const TimeZone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('fr', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Fuseau horaire inconnu');

/** Rôle d'un membre invité sur un voyage (le propriétaire n'est pas un membre). */
export const Role = z.enum(['viewer', 'editor']);
export type Role = z.infer<typeof Role>;

/** Rôle effectif d'un utilisateur sur un voyage. */
export type TripRole = 'owner' | Role;

const TripName = z.string().trim().min(1, 'Nom obligatoire').max(120);
const HikeSpeed = z.number().min(0.5).max(10);

function periodIsValid(v: { startDate?: string; endDate?: string }): boolean {
  if (v.startDate === undefined || v.endDate === undefined) return true;
  const days = toDayNumber(v.endDate) - toDayNumber(v.startDate) + 1;
  return days >= 1 && days <= MAX_TRIP_DAYS;
}

function dayBoundsAreValid(v: { dayStart?: string | null; dayEnd?: string | null }): boolean {
  if (!v.dayStart || !v.dayEnd) return true;
  return v.dayStart < v.dayEnd;
}

const periodMessage = {
  message: `La fin doit suivre le début, sur ${MAX_TRIP_DAYS} jours au plus`,
  path: ['endDate'],
};
const boundsMessage = { message: 'La journée doit finir après son début', path: ['dayEnd'] };

/** Création d'un voyage. */
export const TripCreate = z
  .object({
    name: TripName,
    startDate: IsoDate,
    endDate: IsoDate,
    dayStart: TimeOfDay.default('08:00'),
    dayEnd: TimeOfDay.default('22:00'),
    defaultTimezone: TimeZone.default('Europe/Paris'),
    hikeSpeedKmh: HikeSpeed.default(3.5),
  })
  .refine(periodIsValid, periodMessage)
  .refine(dayBoundsAreValid, boundsMessage);
export type TripCreate = z.infer<typeof TripCreate>;

/** Modification partielle d'un voyage. Les deux dates se modifient ensemble. */
export const TripPatch = z
  .object({
    name: TripName,
    startDate: IsoDate,
    endDate: IsoDate,
    dayStart: TimeOfDay,
    dayEnd: TimeOfDay,
    defaultTimezone: TimeZone,
    hikeSpeedKmh: HikeSpeed,
    /** Photo de couverture (null : aucune). */
    cover: TripCover.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification')
  .refine((v) => (v.startDate === undefined) === (v.endDate === undefined), {
    message: 'Les dates de début et de fin se modifient ensemble',
    path: ['endDate'],
  })
  .refine(periodIsValid, periodMessage)
  .refine(dayBoundsAreValid, boundsMessage);
export type TripPatch = z.infer<typeof TripPatch>;

/** Modification d'un jour : notes, et heures propres au jour (null = heures du voyage). */
export const DayPatch = z
  .object({
    notes: z.string().max(5000),
    dayStart: TimeOfDay.nullable(),
    dayEnd: TimeOfDay.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification')
  .refine(dayBoundsAreValid, boundsMessage);
export type DayPatch = z.infer<typeof DayPatch>;

/** Ajout ou modification d'un membre. */
export const MemberPut = z.object({ role: Role });
export type MemberPut = z.infer<typeof MemberPut>;

/** Voyage tel que renvoyé par l'API. */
export interface Trip {
  id: string;
  ownerEmail: string;
  name: string;
  startDate: string;
  endDate: string;
  dayStart: string;
  dayEnd: string;
  defaultTimezone: string;
  hikeSpeedKmh: number;
  /** Photo de couverture (Wikimedia Commons), ou null. */
  cover: TripCover | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Jour d'un voyage tel que renvoyé par l'API. */
export interface Day {
  id: string;
  date: string;
  dayStart: string | null;
  dayEnd: string | null;
  notes: string;
}

/** Membre invité sur un voyage. */
export interface Member {
  email: string;
  role: Role;
}

/** Ligne de la liste des voyages. */
export interface TripSummary extends Trip {
  role: TripRole;
  dayCount: number;
  /** Étapes placées dans un jour (dossiers et idées exclus). */
  stepCount: number;
  /** Somme des distances des trajets, en mètres. */
  distanceM: number;
  /** Noms des trois premières étapes du voyage, dans l'ordre des jours. */
  places: string[];
}

/** Voyage complet (GET /api/trips/:id). */
export interface TripSnapshot {
  trip: Trip;
  role: TripRole;
  days: Day[];
  members: Member[];
  /** Étapes et dossiers de tout le voyage (dayId null = liste d'idées). */
  steps: Step[];
  stays: Stay[];
  legs: Leg[];
}
