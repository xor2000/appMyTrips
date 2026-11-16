import type { BatchOp, Day, DayPatch, Step, StepPatch } from '@mytrips/core';

/** Commande annulable : opérations de lot pour la refaire et pour l'annuler. */
export interface HistoryEntry {
  label: string;
  redo: BatchOp[];
  undo: BatchOp[];
}

/** Nombre de commandes gardées. */
const LIMIT = 50;

/**
 * Pile annuler/rétablir. Chaque commande connaît son inverse sous forme d'opérations de lot
 * (`POST /api/trips/:id/batch`). Une nouvelle commande efface ce qui pouvait être rétabli.
 */
export function createHistory() {
  let done: HistoryEntry[] = [];
  let undone: HistoryEntry[] = [];
  return {
    get canUndo() {
      return done.length > 0;
    },
    get canRedo() {
      return undone.length > 0;
    },
    push(entry: HistoryEntry) {
      done = [...done, entry].slice(-LIMIT);
      undone = [];
    },
    /** Commande à annuler (déplacée vers « rétablir »), ou null. */
    takeUndo(): HistoryEntry | null {
      const entry = done.pop() ?? null;
      if (entry) undone.push(entry);
      return entry;
    },
    takeRedo(): HistoryEntry | null {
      const entry = undone.pop() ?? null;
      if (entry) done.push(entry);
      return entry;
    },
    /** Annulation échouée : la commande revient dans « annuler ». */
    restoreUndo(entry: HistoryEntry) {
      undone = undone.filter((e) => e !== entry);
      done.push(entry);
    },
    /** Rétablissement échoué : la commande revient dans « rétablir ». */
    restoreRedo(entry: HistoryEntry) {
      done = done.filter((e) => e !== entry);
      undone.push(entry);
    },
    clear() {
      done = [];
      undone = [];
    },
  };
}

/** Champs d'étape remis à leur ancienne valeur, par clé de StepPatch. */
const STEP_FIELDS = [
  'type',
  'name',
  'address',
  'durationMin',
  'fixedStart',
  'notes',
  'bookingRef',
  'bookingUrl',
  'openingHours',
] as const;

/**
 * Opérations inverses de `ops`, calculées sur l'état actuel (avant application), dans l'ordre
 * inverse. Un déplacement est inversé avec le jour, le dossier et la position d'origine.
 */
export function inverseOps(
  state: { steps: Step[]; days: Day[] },
  ops: readonly BatchOp[],
): BatchOp[] {
  const inverse: BatchOp[] = [];
  for (const op of ops) {
    if (op.kind === 'day') {
      const day = state.days.find((d) => d.id === op.id);
      if (!day) continue;
      const patch: DayPatch = {};
      if (op.patch.dayStart !== undefined) patch.dayStart = day.dayStart;
      if (op.patch.dayEnd !== undefined) patch.dayEnd = day.dayEnd;
      if (op.patch.notes !== undefined) patch.notes = day.notes;
      inverse.unshift({ kind: 'day', id: op.id, patch });
      continue;
    }
    const step = state.steps.find((s) => s.id === op.id);
    if (!step) continue;
    const patch: StepPatch = {};
    for (const field of STEP_FIELDS) {
      if (op.patch[field] !== undefined) (patch as Record<string, unknown>)[field] = step[field];
    }
    if (
      op.patch.dayId !== undefined ||
      op.patch.parentId !== undefined ||
      op.patch.position !== undefined
    ) {
      patch.dayId = step.dayId;
      patch.parentId = step.parentId;
      patch.position = step.position;
    }
    inverse.unshift({ kind: 'step', id: op.id, patch });
  }
  return inverse;
}
