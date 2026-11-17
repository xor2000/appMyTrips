import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { guardMissingNumbers, missingImageResolver } from './styles';

function styleWith(...filters: unknown[]): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      { id: 'fond', type: 'background' },
      ...filters.map((filter, i) => ({ id: `c${i}`, type: 'line', source: 's', filter })),
    ],
  } as StyleSpecification;
}

const filterOf = (style: StyleSpecification, index: number) =>
  (style.layers[index] as { filter?: unknown }).filter;

describe('guardMissingNumbers', () => {
  it('ne compare une propriété à un nombre que si elle existe (panneaux de route de Liberty)', () => {
    const style = styleWith([
      'all',
      ['<=', ['get', 'ref_length'], 6],
      ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ]);
    expect(filterOf(guardMissingNumbers(undefined, style), 1)).toEqual([
      'all',
      ['all', ['has', 'ref_length'], ['<=', ['get', 'ref_length'], 6]],
      ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ]);
  });

  it('protège aussi un filtre de premier niveau et le nombre placé à gauche', () => {
    const style = styleWith(['>', 3, ['get', 'rank']], ['<', ['get', 'n'], 2]);
    const fixed = guardMissingNumbers(undefined, style);
    expect(filterOf(fixed, 1)).toEqual(['all', ['has', 'rank'], ['>', 3, ['get', 'rank']]]);
    expect(filterOf(fixed, 2)).toEqual(['all', ['has', 'n'], ['<', ['get', 'n'], 2]]);
  });

  it('laisse intacts les autres filtres et les anciens filtres sans expression', () => {
    const legacy = ['<=', 'ref_length', 6];
    const equality = ['==', ['get', 'class'], 'motorway'];
    const twoProps = ['<', ['get', 'a'], ['get', 'b']];
    const style = styleWith(legacy, equality, twoProps);
    const fixed = guardMissingNumbers(undefined, style);
    expect(filterOf(fixed, 1)).toEqual(legacy);
    expect(filterOf(fixed, 2)).toEqual(equality);
    expect(filterOf(fixed, 3)).toEqual(twoProps);
    expect(fixed.layers[0]).toEqual({ id: 'fond', type: 'background' });
  });

  it('ne touche pas une comparaison sous `!` ou `any`, où l’erreur rend tout le filtre faux', () => {
    const negated = ['!', ['<', ['get', 'rank'], 3]];
    const either = ['any', ['<', ['get', 'rank'], 3], ['==', ['get', 'class'], 'park']];
    const fixed = guardMissingNumbers(undefined, styleWith(negated, either));
    expect(filterOf(fixed, 1)).toEqual(negated);
    expect(filterOf(fixed, 2)).toEqual(either);
  });

  it('ne modifie pas le style reçu', () => {
    const style = styleWith(['<=', ['get', 'ref_length'], 6]);
    const before = structuredClone(style);
    guardMissingNumbers(undefined, style);
    expect(style).toEqual(before);
  });
});

describe('missingImageResolver', () => {
  function fakeMap() {
    const images = new Map<string, { width: number; height: number; data: Uint8Array }>();
    return {
      images,
      hasImage: (id: string) => images.has(id),
      addImage: (id: string, image: { width: number; height: number; data: Uint8Array }) => {
        images.set(id, image);
      },
    };
  }

  it('remplace une icône absente du sprite par une image transparente de 1 × 1 px', () => {
    const map = fakeMap();
    void missingImageResolver(map)('sports_centre');
    const image = map.images.get('sports_centre');
    expect(image?.width).toBe(1);
    expect(image?.height).toBe(1);
    expect([...(image?.data ?? [])]).toEqual([0, 0, 0, 0]);
  });

  it('n’ajoute pas deux fois la même icône', () => {
    const map = fakeMap();
    const resolve = missingImageResolver(map);
    void resolve('gate');
    const first = map.images.get('gate');
    void resolve('gate');
    expect(map.images.get('gate')).toBe(first);
    expect(map.images.size).toBe(1);
  });
});
