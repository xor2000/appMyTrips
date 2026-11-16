import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Clé de position pour insérer un élément à l'index `index` d'une liste de clés triées.
 * Seule la ligne déplacée change : les autres gardent leur clé.
 */
export function keyAt(sortedKeys: readonly string[], index: number): string {
  const before = index > 0 ? (sortedKeys[index - 1] ?? null) : null;
  const after = sortedKeys[index] ?? null;
  return generateKeyBetween(before, after);
}

/** `count` clés ordonnées strictement entre `before` et `after` (null = borne ouverte). */
export function keysBetween(before: string | null, after: string | null, count: number): string[] {
  return generateNKeysBetween(before, after, count);
}

/** Trie par position, puis par identifiant pour départager deux positions égales. */
export function sortByPosition<T extends { id: string; position: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) =>
    a.position === b.position
      ? a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
      : a.position < b.position
        ? -1
        : 1,
  );
}
