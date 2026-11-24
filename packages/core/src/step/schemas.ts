import { z } from 'zod';
import { IsoDate, TimeOfDay } from '../trip/schemas';
import { GpxData } from '../gpx/gpx';
import { LEG_COLOR_COUNT } from '../leg/colors';
import { STEP_TYPES, defaultDuration, type StepType } from './types';

export const StepTypeSchema = z.enum(STEP_TYPES);
export const StepKind = z.enum(['step', 'group']);
export type StepKind = z.infer<typeof StepKind>;

const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-180).max(180);
const Name = z.string().trim().min(1, 'Nom obligatoire').max(200);
/** Clé de position (fractional-indexing : caractères base 62). */
const Position = z.string().regex(/^[0-9A-Za-z]{1,64}$/, 'Position invalide');
const HttpUrl = z
  .string()
  .max(2000)
  // Hôte non vide et aucun espace : suffit à écarter javascript:, data:, etc.
  .regex(/^https?:\/\/[^\s/?#]+\S*$/i, 'Lien http(s) attendu');
const Duration = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);
const Id = z.uuid();
/** Couleur d'un dossier : rang dans la palette des trajets (0 à 7). */
const GroupColor = z
  .number()
  .int()
  .min(0)
  .max(LEG_COLOR_COUNT - 1);

/** Création d'une étape ou d'un dossier (kind = group : ni type ni coordonnées). */
export const StepCreate = z
  .object({
    /** Jour de l'étape, ou null pour la liste d'idées. */
    dayId: Id.nullable(),
    parentId: Id.nullable().default(null),
    kind: StepKind.default('step'),
    type: StepTypeSchema.nullable().optional(),
    name: Name,
    lat: Lat.optional(),
    lng: Lng.optional(),
    address: z.string().max(500).nullable().optional(),
    durationMin: Duration.optional(),
    fixedStart: TimeOfDay.nullable().default(null),
    notes: z.string().max(5000).default(''),
    bookingRef: z.string().max(200).nullable().optional(),
    bookingUrl: HttpUrl.nullable().optional(),
    openingHours: z.string().max(500).nullable().optional(),
    osmRef: z.string().max(100).nullable().optional(),
    /** Position parmi les frères ; absente = en fin de liste. */
    position: Position.optional(),
    /** Tracé d'une randonnée : ses points donnent l'entrée et la sortie de l'étape. */
    gpx: GpxData.optional(),
    /** Durée de randonnée avec le dénivelé (+1 h par 600 m de D+). */
    useElevation: z.boolean().default(false),
    /** Dossier : icône (type d'étape, null : icône dossier) et couleur (null : accent). */
    icon: StepTypeSchema.nullable().optional(),
    color: GroupColor.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'step' && (v.icon != null || v.color != null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['icon'],
        message: 'Icône et couleur sont réservées aux dossiers',
      });
    }
    if (v.gpx && v.type !== 'hike') {
      ctx.addIssue({
        code: 'custom',
        path: ['gpx'],
        message: 'Un GPX ne va qu’avec une randonnée',
      });
    }
    if (v.kind === 'step') {
      if (!v.type) ctx.addIssue({ code: 'custom', path: ['type'], message: 'Type obligatoire' });
      if (!v.gpx && (v.lat === undefined || v.lng === undefined)) {
        ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Coordonnées obligatoires' });
      }
    }
  })
  .transform((v) => {
    const first = v.gpx?.track[0];
    const last = v.gpx?.track[v.gpx.track.length - 1];
    return {
      ...v,
      type: v.kind === 'group' ? null : (v.type as StepType),
      icon: v.icon ?? null,
      color: v.color ?? null,
      lat: first ? first[0] : v.lat,
      lng: first ? first[1] : v.lng,
      exitLat: last ? last[0] : null,
      exitLng: last ? last[1] : null,
      durationMin: v.durationMin ?? (v.kind === 'group' || !v.type ? 0 : defaultDuration(v.type)),
      /** Durée saisie : une randonnée GPX ne la recalcule pas. */
      durationManual: v.durationMin !== undefined,
    };
  });
export type StepCreate = z.infer<typeof StepCreate>;

/** Modification d'une étape, y compris son déplacement (jour, dossier, position). */
export const StepPatch = z
  .object({
    dayId: Id.nullable(),
    parentId: Id.nullable(),
    position: Position,
    type: StepTypeSchema,
    name: Name,
    lat: Lat,
    lng: Lng,
    address: z.string().max(500).nullable(),
    exitLat: Lat.nullable(),
    exitLng: Lng.nullable(),
    durationMin: Duration,
    fixedStart: TimeOfDay.nullable(),
    notes: z.string().max(5000),
    bookingRef: z.string().max(200).nullable(),
    bookingUrl: HttpUrl.nullable(),
    openingHours: z.string().max(500).nullable(),
    useElevation: z.boolean(),
    /** Dossier seulement (l'API refuse sur une étape) ; null : valeur par défaut. */
    icon: StepTypeSchema.nullable(),
    color: GroupColor.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification')
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'Latitude et longitude se modifient ensemble',
    path: ['lng'],
  });
export type StepPatch = z.infer<typeof StepPatch>;

const stayDatesOk = (v: { checkInDate?: string; checkOutDate?: string }) =>
  v.checkInDate === undefined || v.checkOutDate === undefined || v.checkOutDate > v.checkInDate;
const stayDatesMessage = {
  message: 'Au moins une nuit : départ après l’arrivée',
  path: ['checkOutDate'],
};

/** Création d'un séjour (hébergement sur une ou plusieurs nuits). */
export const StayCreate = z
  .object({
    name: Name,
    lat: Lat,
    lng: Lng,
    address: z.string().max(500).nullable().optional(),
    checkInDate: IsoDate,
    checkInTime: TimeOfDay.default('17:00'),
    checkOutDate: IsoDate,
    checkOutTime: TimeOfDay.default('10:00'),
    bookingRef: z.string().max(200).nullable().optional(),
    notes: z.string().max(5000).default(''),
  })
  .refine(stayDatesOk, stayDatesMessage);
export type StayCreate = z.infer<typeof StayCreate>;

export const StayPatch = z
  .object({
    name: Name,
    lat: Lat,
    lng: Lng,
    address: z.string().max(500).nullable(),
    checkInDate: IsoDate,
    checkInTime: TimeOfDay,
    checkOutDate: IsoDate,
    checkOutTime: TimeOfDay,
    bookingRef: z.string().max(200).nullable(),
    notes: z.string().max(5000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification')
  .refine((v) => (v.checkInDate === undefined) === (v.checkOutDate === undefined), {
    message: 'Les dates d’arrivée et de départ se modifient ensemble',
    path: ['checkOutDate'],
  })
  .refine(stayDatesOk, stayDatesMessage);
export type StayPatch = z.infer<typeof StayPatch>;

/** Étape ou dossier tel que renvoyé par l'API. */
export interface Step {
  id: string;
  dayId: string | null;
  parentId: string | null;
  position: string;
  kind: StepKind;
  type: StepType | null;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  /** Point de sortie (randonnée…), null = identique au point d'entrée. */
  exitLat: number | null;
  exitLng: number | null;
  durationMin: number;
  fixedStart: string | null;
  timezone: string | null;
  openingHours: string | null;
  osmRef: string | null;
  bookingRef: string | null;
  bookingUrl: string | null;
  notes: string;
  /** Tracé GPX d'une randonnée (statistiques et tracé simplifié), ou null. */
  gpx: GpxData | null;
  useElevation: boolean;
  /** Durée saisie à la main : non recalculée depuis le GPX. */
  durationManual: boolean;
  /** Dossier : icône choisie (type d'étape), null = icône dossier. */
  icon: StepType | null;
  /** Dossier : couleur choisie (rang 0 à 7 de la palette des trajets), null = accent. */
  color: number | null;
}

/** Séjour tel que renvoyé par l'API. */
export interface Stay {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  bookingRef: string | null;
  notes: string;
}

/** Résultat de géocodage (recherche de lieu). */
export interface Place {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** Type d'étape deviné depuis les tags OSM. */
  type: StepType;
  osmRef: string | null;
}
