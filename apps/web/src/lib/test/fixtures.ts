import type { Day, Leg, Poi, Stay, Step, TripSummary } from '@mytrips/core';

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
    gpx: null,
    useElevation: false,
    durationManual: false,
    icon: null,
    color: null,
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

export function makeLeg(overrides: Partial<Leg> = {}): Leg {
  return {
    id: 'l1',
    fromKey: 'a',
    toKey: 'b',
    mode: 'car',
    distanceM: 72_000,
    durationMin: 75,
    distanceSource: 'router',
    durationSource: 'router',
    geometry: null,
    summary: null,
    departAt: null,
    bookingRef: null,
    color: null,
    notes: '',
    computedAt: null,
    ...overrides,
  };
}

export function makeDay(overrides: Partial<Day> = {}): Day {
  return { id: 'd1', date: '2026-07-10', dayStart: null, dayEnd: null, notes: '', ...overrides };
}

export function makeTripSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: '3f0fa7bf-e95b-4fee-ab08-b30a6385734f',
    ownerEmail: 'alice@example.test',
    name: 'Voyage test Alpes',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    dayStart: '08:00',
    dayEnd: '22:00',
    defaultTimezone: 'Europe/Paris',
    hikeSpeedKmh: 3.5,
    illustration: null,
    version: 1,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    role: 'owner',
    dayCount: 3,
    stepCount: 0,
    distanceM: 0,
    places: [],
    ...overrides,
  };
}
