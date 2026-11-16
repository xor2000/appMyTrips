import { keyAt, sortByPosition } from '@mytrips/core';

type Positioned = { id: string; position: string };

/**
 * Position d'un élément déposé à `index` parmi `siblings` (index calculé sans l'élément déplacé,
 * qui est retiré de la liste s'il en fait partie).
 */
export function positionAt(
  siblings: readonly Positioned[],
  index: number,
  movedId: string,
): string {
  const keys = sortByPosition(siblings.filter((s) => s.id !== movedId)).map((s) => s.position);
  return keyAt(keys, Math.max(0, Math.min(index, keys.length)));
}

/** Nouvelle position pour monter (-1) ou descendre (+1) un élément d'un cran ; null aux bornes. */
export function positionShift(
  siblings: readonly Positioned[],
  id: string,
  delta: -1 | 1,
): string | null {
  const sorted = sortByPosition(siblings);
  const index = sorted.findIndex((s) => s.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= sorted.length) return null;
  // Index de dépôt dans la liste privée de l'élément : un cran plus haut ou plus bas.
  return positionAt(sorted, target, id);
}
