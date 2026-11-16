/** Glisser-déposer natif (HTML5) des étapes : élément en cours de déplacement. */
export const drag = $state<{ stepId: string | null; kind: 'step' | 'group' | null }>({
  stepId: null,
  kind: null,
});

export function startDrag(event: DragEvent, stepId: string, kind: 'step' | 'group') {
  drag.stepId = stepId;
  drag.kind = kind;
  event.dataTransfer?.setData('text/plain', stepId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

export function endDrag() {
  drag.stepId = null;
  drag.kind = null;
}

/** Lieu de dépôt : jour (null = idées), dossier parent, index parmi les frères (sans l'élément). */
export interface DropTarget {
  dayId?: string | null;
  parentId: string | null;
  index: number;
}
