import { dayTimeline, encodePolyline } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { makeLeg, makeStep } from '#lib/test/fixtures.ts';
import { dayLegLines, dayPairs, isManual, legSourceLabel, suggestionFor } from './legs.ts';

const steps = [
  makeStep({ id: 'a', position: 'a0', lat: 45.9, lng: 6.1 }),
  makeStep({ id: 'b', position: 'a1', lat: 45.92, lng: 6.87 }),
  makeStep({ id: 'c', position: 'a2', lat: 46, lng: 7 }),
];
const items = dayTimeline('2026-07-10', steps, []);

describe('dayPairs', () => {
  it('associe chaque paire consécutive à son trajet (ou null), indexée par le départ', () => {
    const leg = makeLeg();
    const pairs = dayPairs(items, [leg, makeLeg({ id: 'autre', fromKey: 'x', toKey: 'y' })]);
    expect([...pairs.keys()]).toEqual(['a', 'b']);
    expect(pairs.get('a')).toMatchObject({ fromKey: 'a', toKey: 'b', leg });
    expect(pairs.get('b')).toMatchObject({ fromKey: 'b', toKey: 'c', leg: null });
  });
});

describe('libellés de source', () => {
  it('forcé si une valeur est saisie, estimé si estimée, sinon routeur', () => {
    expect(legSourceLabel(makeLeg())).toBe('routeur');
    expect(legSourceLabel(makeLeg({ durationSource: 'manual' }))).toBe('forcé');
    expect(
      legSourceLabel(makeLeg({ distanceSource: 'estimate', durationSource: 'estimate' })),
    ).toBe('estimé');
    expect(isManual(makeLeg({ distanceSource: 'manual' }))).toBe(true);
    expect(isManual(makeLeg())).toBe(false);
  });
});

describe('suggestionFor', () => {
  it('propose un trajet saisi à la main, retiré par un réordonnancement, qui touche la paire', () => {
    const removed = makeLeg({
      fromKey: 'a',
      toKey: 'b',
      durationSource: 'manual',
      durationMin: 65,
    });
    expect(suggestionFor({ fromKey: 'b', toKey: 'a' }, [removed])).toBe(removed);
    expect(suggestionFor({ fromKey: 'c', toKey: 'd' }, [removed])).toBeNull();
    expect(suggestionFor({ fromKey: 'a', toKey: 'c' }, [makeLeg()])).toBeNull();
  });
});

describe('dayLegLines', () => {
  it('tracés du jour : géométrie décodée, couleur et pointillés selon le mode', () => {
    const geometry = encodePolyline([
      { lat: 45.9, lng: 6.1 },
      { lat: 45.95, lng: 6.5 },
      { lat: 45.92, lng: 6.87 },
    ]);
    const lines = dayLegLines(items, [
      makeLeg({ geometry }),
      makeLeg({ id: 'l2', fromKey: 'b', toKey: 'c', mode: 'walk' }),
    ]);
    expect(lines).toEqual([
      {
        key: 'a>b',
        color: '--type-transport',
        dashed: false,
        coordinates: [
          [6.1, 45.9],
          [6.5, 45.95],
          [6.87, 45.92],
        ],
      },
      // Sans tracé : ligne droite entre les deux points ; la marche en pointillés.
      {
        key: 'b>c',
        color: '--type-hike',
        dashed: true,
        coordinates: [
          [6.87, 45.92],
          [7, 46],
        ],
      },
    ]);
  });
});
