import { describe, expect, it } from 'vitest';
import { encodePolyline } from '../leg/geo';
import type { Leg } from '../leg/schemas';
import type { Stay, Step } from '../step/schemas';
import type { TripSnapshot } from '../trip/schemas';
import {
  OFFLINE_MAX_TILES,
  estimateTileBytes,
  padBbox,
  planOfflineTiles,
  tilesInBbox,
  tripBboxes,
} from './tiles';

describe('tilesInBbox', () => {
  it('liste les tuiles d’une emprise à un zoom donné', () => {
    // Annecy, zoom 10 : une seule tuile.
    expect(tilesInBbox({ west: 6.1, south: 45.88, east: 6.15, north: 45.92 }, 10)).toEqual([
      { z: 10, x: 529, y: 364 },
    ]);
  });

  it('emprise minuscule : la tuile qui la contient', () => {
    const tiles = tilesInBbox({ west: 6.13, south: 45.9, east: 6.13, north: 45.9 }, 14);
    expect(tiles).toHaveLength(1);
  });

  it('antiméridien : ouest > est, les tuiles des deux côtés', () => {
    const tiles = tilesInBbox({ west: 179.5, south: -17, east: -179.5, north: -16 }, 6);
    const xs = new Set(tiles.map((t) => t.x));
    expect(xs.has(63)).toBe(true);
    expect(xs.has(0)).toBe(true);
    expect(xs.size).toBe(2);
  });

  it('bornes : latitudes extrêmes ramenées dans la projection', () => {
    const tiles = tilesInBbox({ west: -1, south: 84, east: 1, north: 89.9 }, 2);
    expect(tiles.every((t) => t.y >= 0 && t.y < 4)).toBe(true);
  });
});

describe('padBbox', () => {
  it('ajoute 10 % de marge de chaque côté, avec un minimum pour un point isolé', () => {
    expect(padBbox({ west: 6, south: 45, east: 7, north: 46 })).toEqual({
      west: 5.9,
      south: 44.9,
      east: 7.1,
      north: 46.1,
    });
    const point = padBbox({ west: 6, south: 45, east: 6, north: 45 });
    expect(point.east - point.west).toBeGreaterThan(0.009);
  });
});

describe('planOfflineTiles', () => {
  const annecy = { west: 6.08, south: 45.86, east: 6.2, north: 45.94 };
  const chamonix = { west: 6.83, south: 45.9, east: 6.9, north: 45.95 };

  it('zooms 6 à 14, sans doublon entre emprises qui se recouvrent', () => {
    const plan = planOfflineTiles([annecy, annecy]);
    const once = planOfflineTiles([annecy]);
    expect(plan.tiles).toEqual(once.tiles);
    expect(plan.maxZoom).toBe(14);
    expect(new Set(plan.tiles.map((t) => t.z))).toEqual(new Set([6, 7, 8, 9, 10, 11, 12, 13, 14]));
    const keys = plan.tiles.map((t) => `${t.z}/${t.x}/${t.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('plusieurs jours : emprises fusionnées tuile par tuile', () => {
    const both = planOfflineTiles([annecy, chamonix]);
    expect(both.tiles.length).toBeGreaterThan(planOfflineTiles([annecy]).tiles.length);
    expect(both.tiles.length).toBeLessThan(
      planOfflineTiles([annecy]).tiles.length + planOfflineTiles([chamonix]).tiles.length,
    );
  });

  it('plafond : abaisse le zoom maximal pour rester sous la limite', () => {
    const alps = { west: 5, south: 44, east: 8, north: 47 };
    const plan = planOfflineTiles([alps]);
    expect(plan.tiles.length).toBeLessThanOrEqual(OFFLINE_MAX_TILES);
    expect(plan.maxZoom).toBeLessThan(14);
    expect(plan.reduced).toBe(true);
  });

  it('aucune emprise : aucune tuile', () => {
    expect(planOfflineTiles([])).toEqual({ tiles: [], maxZoom: 14, reduced: false });
  });

  it('estimation de taille : 25 Ko par tuile', () => {
    expect(estimateTileBytes(4000)).toBe(100_000_000);
  });
});

function step(id: string, extra: Partial<Step> = {}): Step {
  return {
    id,
    dayId: 'd1',
    parentId: null,
    position: id,
    kind: 'step',
    type: 'museum',
    name: id,
    lat: 45.9,
    lng: 6.13,
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
    ...extra,
  };
}

describe('tripBboxes', () => {
  it('une emprise par jour : étapes, sorties, tracés GPX, trajets et séjours, avec marge', () => {
    const stay: Stay = {
      id: 'h',
      name: 'Hôtel',
      lat: 45.8,
      lng: 6.1,
      address: null,
      checkInDate: '2026-07-10',
      checkInTime: '17:00',
      checkOutDate: '2026-07-11',
      checkOutTime: '10:00',
      bookingRef: null,
      notes: '',
    };
    const leg = {
      id: 'l',
      fromKey: 'a',
      toKey: 'b',
      geometry: encodePolyline([
        { lat: 45.9, lng: 6.13 },
        { lat: 46.2, lng: 6.5 },
      ]),
    } as Leg;
    const snapshot = {
      days: [
        { id: 'd1', date: '2026-07-10', dayStart: null, dayEnd: null, notes: '' },
        { id: 'd2', date: '2026-07-11', dayStart: null, dayEnd: null, notes: '' },
        { id: 'd3', date: '2026-07-12', dayStart: null, dayEnd: null, notes: '' },
      ],
      steps: [
        step('a'),
        step('b', { lat: 46, lng: 6.3, exitLat: 46.1, exitLng: 6.4 }),
        step('c', { dayId: 'd2', lat: 45.92, lng: 6.87 }),
        step('idee', { dayId: null, lat: 10, lng: 10 }),
      ],
      stays: [stay],
      legs: [leg],
    } as unknown as TripSnapshot;
    const boxes = tripBboxes(snapshot);
    expect(boxes).toHaveLength(2);
    const [d1, d2] = boxes;
    // J1 : étapes a et b (sortie comprise), séjour du soir, tracé du trajet a → b.
    expect(d1!.west).toBeLessThan(6.1);
    expect(d1!.north).toBeGreaterThan(46.2);
    expect(d1!.east).toBeGreaterThan(6.5);
    // J2 : étape c et séjour du matin.
    expect(d2!.east).toBeGreaterThan(6.87);
    expect(d2!.south).toBeLessThan(45.8);
    // Les idées ne comptent pas.
    expect(boxes.every((b) => b.north < 47)).toBe(true);
  });
});
