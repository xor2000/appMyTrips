import type { BatchOp, Day, Step } from '@mytrips/core';
import CalendarPlus from 'lucide-svelte/icons/calendar-plus';
import ExternalLink from 'lucide-svelte/icons/external-link';
import Lightbulb from 'lucide-svelte/icons/lightbulb';
import MoveRight from 'lucide-svelte/icons/move-right';
import Pencil from 'lucide-svelte/icons/pencil';
import Trash2 from 'lucide-svelte/icons/trash-2';
import type { MenuEntry } from '#lib/components/ContextMenu.svelte';
import { dayTabLabel } from '#lib/format.ts';
import { positionAt } from './moves';

/** Point d'ouverture du menu contextuel (coordonnées de la fenêtre). */
export interface MenuPoint {
  x: number;
  y: number;
}

/**
 * Touche Menu ou Maj+F10 sur un élément : point d'ouverture du menu contextuel (sous l'élément,
 * à gauche) ; null pour toute autre touche. Empêche alors le comportement du navigateur.
 */
export function contextMenuKey(event: KeyboardEvent): MenuPoint | null {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return null;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: rect.left, y: rect.bottom };
}

/** Destination de « Déplacer vers » : jour, ou idées (`dayId` null). */
export interface MoveTarget {
  dayId: string | null;
  label: string;
  /** Date du jour (« sam. 11 juil. »), null pour les idées. */
  hint: string | null;
}

/**
 * Destinations proposées pour un lieu ou un dossier : les idées puis les jours, sans l'endroit où il
 * se trouve (son jour, même s'il est rangé dans un dossier, ou les idées).
 */
export function moveTargets(step: Step, days: readonly Day[]): MoveTarget[] {
  const targets: MoveTarget[] = [];
  if (step.dayId !== null) targets.push({ dayId: null, label: 'Idées', hint: null });
  days.forEach((d, i) => {
    if (d.id !== step.dayId) targets.push(dayTarget(d, i));
  });
  return targets;
}

/** Jour comme destination d'un sous-menu : « J2 », avec sa date en indice. */
function dayTarget(day: Day, index: number): MoveTarget {
  return { dayId: day.id, label: `J${index + 1}`, hint: dayTabLabel(day.date) };
}

/** Le point GPS dans Google Maps (recherche par coordonnées). */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function googleMapsEntry(lat: number, lng: number): MenuEntry {
  return {
    kind: 'link',
    label: 'Voir dans Google Maps',
    icon: ExternalLink,
    href: googleMapsUrl(lat, lng),
  };
}

/**
 * Opération de lot qui place l'élément à la fin des racines du jour visé (ou des idées), hors de
 * tout dossier. Un dossier emporte ses étapes (règle de l'API).
 */
export function moveToEndOp(step: Step, dayId: string | null, steps: readonly Step[]): BatchOp {
  const roots = steps.filter((s) => s.dayId === dayId && s.parentId === null);
  return {
    kind: 'step',
    id: step.id,
    patch: { dayId, parentId: null, position: positionAt(roots, roots.length, step.id) },
  };
}

/** Actions du menu contextuel d'un lieu ou d'un dossier. */
export interface StepMenuHandlers {
  edit: (step: Step) => void;
  remove: (step: Step) => void;
  moveTo: (step: Step, dayId: string | null) => void;
}

/**
 * Menu contextuel d'un lieu (jour, dossier, idées) ou d'un dossier : Modifier, Supprimer, Déplacer
 * vers (sous-menu), Voir dans Google Maps (lieu seulement). En lecture seule, Google Maps seul.
 */
export function stepMenuEntries(
  step: Step,
  days: readonly Day[],
  canEdit: boolean,
  handlers: StepMenuHandlers,
): MenuEntry[] {
  const entries: MenuEntry[] = [];
  if (canEdit) {
    entries.push(
      { kind: 'action', label: 'Modifier', icon: Pencil, run: () => handlers.edit(step) },
      {
        kind: 'action',
        label: 'Supprimer',
        icon: Trash2,
        danger: true,
        run: () => handlers.remove(step),
      },
    );
    const targets = moveTargets(step, days);
    if (targets.length > 0) {
      entries.push({
        kind: 'submenu',
        label: 'Déplacer vers',
        icon: MoveRight,
        items: targets.map((t) => ({
          label: t.label,
          hint: t.hint,
          run: () => handlers.moveTo(step, t.dayId),
        })),
      });
    }
  }
  if (step.kind === 'step' && step.lat !== null && step.lng !== null) {
    entries.push(googleMapsEntry(step.lat, step.lng));
  }
  return entries;
}

/** Actions du menu contextuel d'un résultat de recherche (lieu trouvé, pas encore une étape). */
export interface PlaceMenuHandlers {
  /** Ajout au jour visé, ou aux idées (`dayId` null). */
  addTo: (dayId: string | null) => void;
  /** Suppression de l'étape déjà créée depuis ce lieu (même référence OSM). */
  remove: () => void;
}

/**
 * Menu contextuel commun aux résultats de « Rechercher » et d'« Explorer la zone » : Ajouter aux
 * idées, Ajouter à un jour (sous-menu de tous les jours), Voir dans Google Maps. Lieu déjà dans le
 * voyage : Supprimer, comme sa popup. En lecture seule, Google Maps seul.
 */
export function placeMenuEntries(
  place: { lat: number; lng: number },
  days: readonly Day[],
  canEdit: boolean,
  added: boolean,
  handlers: PlaceMenuHandlers,
): MenuEntry[] {
  const entries: MenuEntry[] = [];
  if (canEdit && added) {
    entries.push({
      kind: 'action',
      label: 'Supprimer',
      icon: Trash2,
      danger: true,
      run: handlers.remove,
    });
  } else if (canEdit) {
    entries.push({
      kind: 'action',
      label: 'Ajouter aux idées',
      icon: Lightbulb,
      run: () => handlers.addTo(null),
    });
    if (days.length > 0) {
      entries.push({
        kind: 'submenu',
        label: 'Ajouter à un jour',
        icon: CalendarPlus,
        items: days.map((d, i) => {
          const { label, hint } = dayTarget(d, i);
          return { label, hint, run: () => handlers.addTo(d.id) };
        }),
      });
    }
  }
  entries.push(googleMapsEntry(place.lat, place.lng));
  return entries;
}
