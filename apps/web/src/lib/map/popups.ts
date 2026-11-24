import {
  LEG_MODE_INFO,
  STEP_TYPE_INFO,
  type Day,
  type Leg,
  type Place,
  type Poi,
  type Step,
  type StepType,
} from '@mytrips/core';
import { formatDistance, formatDuration } from '#lib/format.ts';
import { legSourceLabel } from '#lib/legs/legs.ts';
import type { MapPoint } from './points';

/**
 * Ce que montre une popup de la carte : marqueur d'étape ou d'idée, tracé de trajet, lieu découvert,
 * lieu sous un clic droit (géocodage inverse).
 */
export type PopupTarget =
  | { kind: 'step'; point: MapPoint }
  | { kind: 'leg'; key: string }
  | { kind: 'poi'; poi: Poi }
  | { kind: 'place'; place: Place };

/** Élément choisi dans la colonne, à cadrer sur la carte (clé de point, de paire, id de lieu). */
export type FocusTarget =
  { kind: 'step'; key: string } | { kind: 'leg'; key: string } | { kind: 'poi'; id: string };

/** Bouton d'une popup de la carte. */
export interface PopupAction {
  label: string;
  icon: 'edit' | 'trash' | 'plus';
  /** Bouton plein (action principale), sinon bouton à filet. */
  primary?: boolean;
  run: () => void;
}

/**
 * Contenu d'une popup de la carte, sur le modèle des popups de la maquette de référence
 * (`buildPoiPopup`, `buildRoutePopup`, `buildDiscoverPopup`) : catégorie colorée, nom, notes,
 * ligne d'infos avec pastille, actions.
 */
export interface MapPopupContent {
  kind: 'step' | 'leg' | 'poi';
  /** « Musée · J1 », « Voiture · J1 », « Musée ». */
  category: string;
  /** Icône du type, à gauche du nom (étapes, idées, lieux découverts, clic droit). */
  icon?: StepType;
  /** Source des données, en petit sous les notes (« OpenStreetMap »…). */
  source?: string;
  /** Variable CSS de la couleur de la catégorie. */
  color: string;
  title: string;
  /** Adresse, sous le nom et avant les notes (étape ou idée). */
  address?: string;
  notes: string;
  /** Infos séparées par « · » (distance, durée). */
  meta: string[];
  chip: { label: string; check: boolean } | null;
  actions: PopupAction[];
}

const join = (...parts: (string | null)[]) => parts.filter((p) => p).join(' · ');

/**
 * Étape ou idée, comme la popup du clic droit : « type · jour », icône du type et nom, adresse,
 * notes, Modifier et Supprimer.
 */
export function stepPopupContent(
  step: Step,
  days: readonly Day[],
  canEdit: boolean,
  handlers: { edit: (stepId: string) => void; remove: (stepId: string) => void },
): MapPopupContent {
  const index = step.dayId === null ? -1 : days.findIndex((d) => d.id === step.dayId);
  const context = step.dayId === null ? 'Idée' : index >= 0 ? `J${index + 1}` : null;
  return {
    kind: 'step',
    category: join(step.type ? STEP_TYPE_INFO[step.type].label : 'Lieu', context),
    color: step.type ? STEP_TYPE_INFO[step.type].color : '--type-transport',
    ...(step.type ? { icon: step.type } : {}),
    title: step.name,
    ...(step.address ? { address: step.address } : {}),
    notes: step.notes,
    meta: [],
    chip: null,
    actions: canEdit
      ? [
          { label: 'Modifier', icon: 'edit', run: () => handlers.edit(step.id) },
          { label: 'Supprimer', icon: 'trash', run: () => handlers.remove(step.id) },
        ]
      : [],
  };
}

/** Trajet : « mode · jour », départ → arrivée, distance · durée, origine des valeurs en pastille. */
export function legPopupContent(
  leg: Leg,
  /** Variable CSS de la couleur du trajet (celle de son tracé). */
  color: string,
  names: { from: string; to: string },
  dayLabel: string | null,
  canEdit: boolean,
  handlers: { edit: (legId: string) => void; remove: (legId: string) => void },
): MapPopupContent {
  const source = legSourceLabel(leg);
  return {
    kind: 'leg',
    category: join(LEG_MODE_INFO[leg.mode].label, dayLabel),
    color,
    title: `${names.from} → ${names.to}`,
    notes: leg.summary ?? '',
    meta: [
      ...(leg.distanceM !== null ? [formatDistance(leg.distanceM)] : []),
      formatDuration(leg.durationMin),
    ],
    chip: source === 'routeur' ? null : { label: source, check: false },
    actions: canEdit
      ? [
          { label: 'Modifier', icon: 'edit', run: () => handlers.edit(leg.id) },
          { label: 'Supprimer', icon: 'trash', run: () => handlers.remove(leg.id) },
        ]
      : [],
  };
}

/** Actions d'un lieu qu'on peut ajouter (au jour affiché ou aux idées), ou supprimer une fois ajouté. */
interface AddPlaceHandlers {
  addToDay: () => void;
  addToIdeas: () => void;
  remove: () => void;
}

/**
 * Popup d'un lieu à ajouter : type en couleur, icône et nom, adresse, source en petit, Ajouter au
 * jour et aux idées.
 */
function addablePlaceContent(
  place: { stepType: StepType; name: string; address: string | null },
  source: string | null,
  added: boolean,
  dayLabel: string | null,
  canEdit: boolean,
  handlers: AddPlaceHandlers,
): MapPopupContent {
  let actions: PopupAction[] = [];
  if (canEdit && added) {
    actions = [{ label: 'Supprimer', icon: 'trash', run: handlers.remove }];
  } else if (canEdit) {
    actions = [
      ...(dayLabel
        ? [
            {
              label: `Ajouter à ${dayLabel}`,
              icon: 'plus' as const,
              primary: true,
              run: handlers.addToDay,
            },
          ]
        : []),
      { label: 'Ajouter aux idées', icon: 'plus', primary: !dayLabel, run: handlers.addToIdeas },
    ];
  }
  return {
    kind: 'poi',
    category: STEP_TYPE_INFO[place.stepType].label,
    icon: place.stepType,
    ...(source ? { source } : {}),
    color: STEP_TYPE_INFO[place.stepType].color,
    title: place.name,
    notes: place.address ?? '',
    meta: [],
    chip: added ? { label: 'Déjà ajouté', check: true } : null,
    actions,
  };
}

/**
 * Lieu de la découverte : type, icône et nom, adresse, source. Pas encore dans le voyage : « Ajouter à
 * J2 » (jour affiché) et « Ajouter aux idées » ; déjà ajouté : pastille cochée et « Supprimer ».
 */
export function poiPopupContent(
  poi: Poi,
  added: boolean,
  dayLabel: string | null,
  canEdit: boolean,
  handlers: AddPlaceHandlers,
): MapPopupContent {
  const source = poi.source === 'geoapify' ? 'Geoapify · OpenStreetMap' : 'OpenStreetMap';
  return addablePlaceContent(poi, source, added, dayLabel, canEdit, handlers);
}

/**
 * Lieu sous un clic droit : celui du géocodage inverse (Photon), placé au point cliqué (« ici ») ;
 * rien trouvé ou Photon injoignable : un point sans nom.
 */
export function placeAtPoint(found: Place | null, point: { lat: number; lng: number }): Place {
  return found
    ? { ...found, ...point }
    : { name: 'Point sur la carte', address: null, type: 'other', osmRef: null, ...point };
}

/** Clic droit sur la carte : même popup qu'un lieu découvert, sans source pour un point sans lieu. */
export function placePopupContent(
  place: Place,
  added: boolean,
  dayLabel: string | null,
  canEdit: boolean,
  handlers: AddPlaceHandlers,
): MapPopupContent {
  return addablePlaceContent(
    { stepType: place.type, name: place.name, address: place.address },
    place.osmRef ? 'OpenStreetMap' : null,
    added,
    dayLabel,
    canEdit,
    handlers,
  );
}
