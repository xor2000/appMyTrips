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
    gpx: null,
    useElevation: false,
    durationManual: false,
    ...overrides,
  };
}

const HIKE_GPX = {
  stats: {
    distanceM: 12_400,
    ascentM: 620,
    descentM: 20,
    minEle: 450,
    maxEle: 1070,
    isLoop: false,
    pointCount: 1200,
  },
  track: [
    [45.9, 6.13, 450],
    [45.92, 6.16, 760],
    [45.95, 6.2, 1070],
  ] as [number, number, number | null][],
};

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

  it('en vue « Tout le voyage », étiquette chaque étape avec son jour, les idées « Idée »', () => {
    const steps = [step('a'), step('b', { dayId: 'd2' }), step('idee', { dayId: null })];
    const points = mapPoints({ days, steps, stays: [stay] }, null);
    expect(points.map((p) => [p.key, p.label])).toEqual([
      ['a', 'J1'],
      ['b', 'J2'],
      ['stay:h', 'H'],
      ['idee', 'Idée'],
    ]);
  });

  it('randonnée linéaire : un marqueur d’arrivée distinct ; aucun pour une boucle', () => {
    const hike = step('r', {
      type: 'hike',
      lat: 45.9,
      lng: 6.13,
      exitLat: 45.95,
      exitLng: 6.2,
      gpx: HIKE_GPX,
    });
    const points = mapPoints({ days, steps: [hike], stays: [] }, 'd1');
    expect(points.map((p) => [p.key, p.label])).toEqual([
      ['r', '1'],
      ['r:exit', '⚑'],
    ]);
    expect(points[1]).toMatchObject({ lat: 45.95, lng: 6.2, stepId: 'r', color: '--type-hike' });
    const loop = step('b', {
      type: 'hike',
      exitLat: 45,
      exitLng: 6,
      gpx: { ...HIKE_GPX, stats: { ...HIKE_GPX.stats, isLoop: true } },
    });
    expect(mapPoints({ days, steps: [loop], stays: [] }, 'd1')).toHaveLength(1);
  });

  it('ignore les étapes sans coordonnées', () => {
    const points = mapPoints(
      { days, steps: [step('a', { lat: null, lng: null })], stays: [] },
      'd1',
    );
    expect(points).toEqual([]);
  });

  describe('idées', () => {
    const data = () => ({
      days,
      steps: [
        step('a'),
        step('i1', { dayId: null, name: 'Musée à voir', lat: 45.5, lng: 6.5 }),
        step('i2', { dayId: null, name: 'Sans lieu', lat: null, lng: null }),
        step('b', { position: 'b' }),
      ],
      stays: [] as Stay[],
    });

    it('apparaissent sur la carte d’un jour, sans compter dans la numérotation', () => {
      const points = mapPoints(data(), 'd1');
      expect(points.filter((p) => !p.idea).map((p) => p.label)).toEqual(['1', '2']);
      const idea = points.find((p) => p.key === 'i1');
      expect(idea).toMatchObject({ label: 'Idée', idea: true, stepId: 'i1', name: 'Musée à voir' });
      expect(points.find((p) => p.key === 'i2')).toBeUndefined();
    });

    it('apparaissent aussi sur la carte de tout le voyage', () => {
      const points = mapPoints(data(), null);
      expect(points.find((p) => p.key === 'i1')).toMatchObject({ label: 'Idée', idea: true });
    });

    it('les étapes d’un jour ne sont pas des idées', () => {
      for (const p of mapPoints(data(), 'd1').filter((p) => p.key !== 'i1')) {
        expect(p.idea).toBe(false);
      }
    });
  });
});
