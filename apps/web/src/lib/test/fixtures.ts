import type { Day, Poi, Stay, Step } from '@mytrips/core';

/** Données de test partagées par les tests de composants. */
export const days: Day[] = [
  { id: 'd1', date: '2026-07-10', dayStart: null, dayEnd: null, notes: '' },
  { id: 'd2', date: '2026-07-11', dayStart: null, dayEnd: null, notes: '' },
];

export function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 's1',
    dayId: 'd1',
    parentId: null,
    position: 'a1',
    kind: 'step',
    type: 'museum',
    name: 'Musée du Louvre',
    lat: 48.8606,
    lng: 2.3376,
    address: 'Rue de Rivoli, 75001 Paris',
    exitLat: null,
    exitLng: null,
    durationMin: 120,
    fixedStart: null,
    timezone: 'Europe/Paris',
    openingHours: null,
    osmRef: null,
    bookingRef: null,
    bookingUrl: null,
    notes: '',
    ...overrides,
  };
}

export function makeStay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: 'h1',
    name: 'Chalet de Cotagne',
    lat: 45.88,
    lng: 6.31,
    address: null,
    checkInDate: '2026-07-10',
    checkInTime: '17:00',
    checkOutDate: '2026-07-12',
    checkOutTime: '10:00',
    bookingRef: null,
    notes: '',
    ...overrides,
  };
}

export function makePoi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: 'osm:N2001',
    osmRef: 'N2001',
    name: 'Musée des Arts décoratifs',
    category: 'museum',
    stepType: 'museum',
    lat: 48.863,
    lng: 2.333,
    address: null,
    openingHours: null,
    website: null,
    phone: null,
    cuisine: null,
    wikidata: null,
    wikipedia: null,
    source: 'overpass',
    ...overrides,
  };
}
