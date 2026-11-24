import {
  LEG_MODE_INFO,
  STEP_TYPE_INFO,
  type Day,
  type Leg,
  type Poi,
  type Step,
} from '@mytrips/core';
import { formatDistance, formatDuration } from '#lib/format.ts';
import { legSourceLabel } from '#lib/legs/legs.ts';
import type { MapPoint } from './points';

/** Ce que montre une popup de la carte : marqueur d'étape ou d'idée, tracé de trajet, lieu découvert. */
export type PopupTarget =
  { kind: 'step'; point: MapPoint } | { kind: 'leg'; key: string } | { kind: 'poi'; poi: Poi };

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
  /** « Musée · J1 », « Voiture · J1 », « Musée · OpenStreetMap ». */
  category: string;
  /** Variable CSS de la couleur de la catégorie. */
  color: string;
  title: string;
  notes: string;
  /** Infos séparées par « · » (distance, durée). */
  meta: string[];
  chip: { label: string; check: boolean } | null;
  actions: PopupAction[];
}

const join = (...parts: (string | null)[]) => parts.filter((p) => p).join(' · ');

/** Étape ou idée : « type · jour », nom, notes, Modifier et Supprimer. */
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
    title: step.name,
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
  names: { from: string; to: string },
  dayLabel: string | null,
  canEdit: boolean,
  handlers: { edit: (legId: string) => void; remove: (legId: string) => void },
): MapPopupContent {
  const source = legSourceLabel(leg);
  return {
    kind: 'leg',
    category: join(LEG_MODE_INFO[leg.mode].label, dayLabel),
    color: LEG_MODE_INFO[leg.mode].color,
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

/**
 * Lieu de la découverte : « type · source », nom, adresse. Pas encore dans le voyage : « Ajouter à
 * J2 » (jour affiché) et « Ajouter aux idées » ; déjà ajouté : pastille cochée et « Supprimer ».
 */
export function poiPopupContent(
  poi: Poi,
  added: boolean,
  dayLabel: string | null,
  canEdit: boolean,
  handlers: { addToDay: () => void; addToIdeas: () => void; remove: () => void },
): MapPopupContent {
  const source = poi.source === 'geoapify' ? 'Geoapify · OpenStreetMap' : 'OpenStreetMap';
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
    category: join(STEP_TYPE_INFO[poi.stepType].label, source),
    color: STEP_TYPE_INFO[poi.stepType].color,
    title: poi.name,
    notes: poi.address ?? '',
    meta: [],
    chip: added ? { label: 'Déjà ajouté', check: true } : null,
    actions,
  };
}
