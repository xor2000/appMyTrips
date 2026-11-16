import { describe, expect, it } from 'vitest';
import { keyAt, keysBetween, sortByPosition } from './order';

describe('ordre des étapes (clés fractionnaires)', () => {
  it('génère une première clé dans une liste vide', () => {
    expect(keyAt([], 0)).toBeTypeOf('string');
  });

  it('insère en tête, en fin et entre deux éléments', () => {
    const a = keyAt([], 0);
    const b = keyAt([a], 1);
    const first = keyAt([a, b], 0);
    const middle = keyAt([a, b], 1);
    expect(first < a).toBe(true);
    expect(a < middle && middle < b).toBe(true);
    expect(b > a).toBe(true);
  });

  it('génère plusieurs clés ordonnées entre deux bornes', () => {
    const keys = keysBetween('a0', 'a1', 3);
    expect(keys).toHaveLength(3);
    expect([...keys].sort()).toEqual(keys);
    expect(keys.every((k) => k > 'a0' && k < 'a1')).toBe(true);
  });

  it('trie par position, puis par identifiant en cas d’égalité', () => {
    const items = [
      { id: 'b', position: 'a1' },
      { id: 'c', position: 'a0' },
      { id: 'a', position: 'a1' },
    ];
    expect(sortByPosition(items).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
});
