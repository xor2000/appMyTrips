import type { Day, Stay, Step } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { mapPoints } from './points';

const days: Day[] = [
  { id: 'd1', date: '2026-07-10', dayStart: null, dayEnd: null, notes: '' },
  { id: 'd2', date: '2026-07-11', dayStart: null, dayEnd: null, notes: '' },
];

function step(id: string, overrides: Partial<Step> = {}): Step {
  return {
    id,
    dayId: 'd1',
    parentId: null,
    position: id,
    kind: 'step',
    type: 'museum',
    name: id.toUpperCase(),
    lat: 45,
    lng: 6,
    address: null,
    exitLat: null,
    exitLng: null,
    durationMin: 60,
    fixedStart: null,
    timezone: null,
    openingHours: null,
    osmRef: null,
    bookingRef: null,
    bookingUrl: null,
    notes: '',
    ...overrides,
  };
}

const stay: Stay = {
  id: 'h',
  name: 'Chalet',
  lat: 45.5,
  lng: 6.5,
  address: null,
  checkInDate: '2026-07-10',
  checkInTime: '17:00',
  checkOutDate: '2026-07-11',
  checkOutTime: '10:00',
  bookingRef: null,
  notes: '',
};

describe('mapPoints', () => {
  it('numérote les étapes du jour dans l’ordre de la timeline, dossiers compris', () => {
    const g = step('g', { kind: 'group', type: null, lat: null, lng: null, position: 'b' });
    const steps = [
      step('c', { position: 'c' }),
      step('a', { position: 'a' }),
      g,
      step('g1', { parentId: 'g', position: 'a' }),
    ];
    const points = mapPoints({ days, steps, stays: [] }, 'd1');
    expect(points.map((p) => [p.key, p.label])).toEqual([
      ['a', '1'],
      ['g1', '2'],
      ['c', '3'],
    ]);
    expect(points[0]).toMatchObject({ name: 'A', color: '--type-museum', faded: false });
  });

  it('marque les séjours du jour d’un « H »', () => {
    const points = mapPoints({ days, steps: [step('a')], stays: [stay] }, 'd1');
    expect(points.map((p) => p.label)).toEqual(['1', 'H']);
    expect(points[1]).toMatchObject({ key: 'stay:h:2026-07-10:end', color: '--type-hotel' });
  });

  it('en vue « Tout le voyage », étiquette chaque étape avec son jour et ignore les idées', () => {
    const steps = [step('a'), step('b', { dayId: 'd2' }), step('idee', { dayId: null })];
    const points = mapPoints({ days, steps, stays: [stay] }, null);
    expect(points.map((p) => [p.key, p.label])).toEqual([
      ['a', 'J1'],
      ['b', 'J2'],
      ['stay:h', 'H'],
    ]);
  });

  it('ignore les étapes sans coordonnées', () => {
    const points = mapPoints(
      { days, steps: [step('a', { lat: null, lng: null })], stays: [] },
      'd1',
    );
    expect(points).toEqual([]);
  });
});
