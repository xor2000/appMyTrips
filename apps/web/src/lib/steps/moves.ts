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
