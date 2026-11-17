import type { ScheduledItem } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { days, makeLeg, makeStep } from '#lib/test/fixtures.ts';
import { buildDayViews } from './dayViews';

const steps = [
  makeStep({ id: 'a', dayId: 'd1', position: 'a0', name: 'A' }),
  makeStep({ id: 'b', dayId: 'd1', position: 'a1', name: 'B' }),
  makeStep({ id: 'c', dayId: 'd2', position: 'a0', name: 'C' }),
  makeStep({ id: 'd', dayId: 'd2', position: 'a1', name: 'D' }),
  makeStep({ id: 'i', dayId: null, position: 'a0', name: 'Idée' }),
];

const time = (key: string, start: string): ScheduledItem => ({
  key,
  kind: 'step',
  start: { time: start, dayOffset: 0 },
  end: { time: start, dayOffset: 0 },
  timezone: 'Europe/Paris',
  freeBeforeMin: 0,
  issues: [],
});

describe('buildDayViews', () => {
  const leg = makeLeg({ id: 'l1', fromKey: 'c', toKey: 'd' });
  const views = buildDayViews(
    { days, steps, stays: [], legs: [leg] },
    new Map([
      ['d1', { items: [time('a', '08:00'), time('b', '10:00')] }],
      ['d2', { items: [time('c', '09:00')] }],
    ]),
  );

  it('un modèle par jour, dans l’ordre, avec ses étapes', () => {
    expect(views.map((v) => [v.day.id, v.index, v.items.map((i) => i.key)])).toEqual([
      ['d1', 0, ['a', 'b']],
      ['d2', 1, ['c', 'd']],
    ]);
  });

  it('paires de trajets de chaque jour, avec le trajet existant', () => {
    expect([...views[0]!.pairs.keys()]).toEqual(['a']);
    expect(views[0]!.pairs.get('a')?.leg).toBeNull();
    expect(views[1]!.pairs.get('c')?.leg?.id).toBe('l1');
  });

  it('numéros de carte propres à chaque jour (sans les idées)', () => {
    expect([...views[0]!.labels]).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]);
    expect([...views[1]!.labels]).toEqual([
      ['c', '1'],
      ['d', '2'],
    ]);
  });

  it('horaires du jour par clé ; jour sans horaires : vide', () => {
    expect(views[0]!.times.get('b')?.start.time).toBe('10:00');
    expect(views[1]!.times.get('d')).toBeUndefined();
    const none = buildDayViews({ days, steps, stays: [], legs: [] }, new Map());
    expect(none[0]!.times.size).toBe(0);
  });
});
