import { STEP_TYPE_INFO, type Day, type Step } from '@mytrips/core';

/** Contenu de la popup d'une étape sur la carte (comme la popup d'un lieu de la référence). */
export interface StepPopupInfo {
  stepId: string;
  /** Libellé du type (« Musée »), ou « Lieu » sans type. */
  category: string;
  /** Jour de l'étape (« J2 »), « Idée » pour une étape sans jour, vide si le jour est inconnu. */
  context: string;
  name: string;
  notes: string;
  /** Variable CSS de la couleur du type. */
  color: string;
}

export function stepPopupInfo(step: Step, days: readonly Day[]): StepPopupInfo {
  const index = step.dayId === null ? -1 : days.findIndex((d) => d.id === step.dayId);
  return {
    stepId: step.id,
    category: step.type ? STEP_TYPE_INFO[step.type].label : 'Lieu',
    context: step.dayId === null ? 'Idée' : index >= 0 ? `J${index + 1}` : '',
    name: step.name,
    notes: step.notes,
    color: step.type ? STEP_TYPE_INFO[step.type].color : '--type-transport',
  };
}
