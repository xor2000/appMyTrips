import { describe, expect, it } from 'vitest';
import { positionAt, positionShift } from './moves';

const siblings = [
  { id: 'a', position: 'a1' },
  { id: 'b', position: 'a2' },
  { id: 'c', position: 'a3' },
];

describe('positionAt (dépôt d’un élément à un index)', () => {
  it('donne une position avant le premier élément', () => {
    expect(positionAt(siblings, 0, 'x') < 'a1').toBe(true);
  });

  it('donne une position entre deux éléments', () => {
    const p = positionAt(siblings, 1, 'x');
    expect(p > 'a1' && p < 'a2').toBe(true);
  });

  it('donne une position après le dernier élément', () => {
    expect(positionAt(siblings, 3, 'x') > 'a3').toBe(true);
  });

  it('ignore l’élément déplacé parmi ses propres frères', () => {
    // Une fois « a » retiré, la liste est [b, c] : l’index 1 tombe entre b et c.
    const p = positionAt(siblings, 1, 'a');
    expect(p > 'a2' && p < 'a3').toBe(true);
  });

  it('fonctionne dans une liste vide', () => {
    expect(positionAt([], 0, 'x')).toBeTypeOf('string');
  });
});

describe('positionShift (monter / descendre)', () => {
  it('monte un élément d’un cran', () => {
    const p = positionShift(siblings, 'c', -1)!;
    expect(p > 'a1' && p < 'a2').toBe(true);
  });

  it('descend un élément d’un cran', () => {
    const p = positionShift(siblings, 'a', 1)!;
    expect(p > 'a2' && p < 'a3').toBe(true);
  });

  it('renvoie null aux bornes', () => {
    expect(positionShift(siblings, 'a', -1)).toBeNull();
    expect(positionShift(siblings, 'c', 1)).toBeNull();
  });
});
