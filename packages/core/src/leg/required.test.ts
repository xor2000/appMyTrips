import { describe, expect, it } from 'vitest';
import type { Stay, Step } from '../step/schemas';
import { dayTimeline } from '../step/timeline';
import { legPairKey, requiredLegs, staleLegs, tripRequiredLegKeys } from './required';

function step(id: string, position: string, extra: Partial<Step> = {}): Step {
  return {
    id,
    dayId: 'd1',
    parentId: null,
    position,
    kind: 'step',
    type: 'museum',
    name: id,
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
    ...extra,
  };
}

const stay: Stay = {
  id: 'h1',
  name: 'Hôtel',
  lat: 46,
  lng: 7,
  address: null,
  checkInDate: '2026-07-09',
  checkInTime: '17:00',
  checkOutDate: '2026-07-11',
  checkOutTime: '10:00',
  bookingRef: null,
  notes: '',
};

const keys = (items: ReturnType<typeof dayTimeline>) =>
  requiredLegs(items).map((l) => `${l.fromKey}>${l.toKey}`);

describe('requiredLegs', () => {
  it('jour vide ou une seule étape : aucun trajet', () => {
    expect(requiredLegs(dayTimeline('2026-07-12', [], []))).toEqual([]);
    expect(requiredLegs(dayTimeline('2026-07-12', [step('a', 'a0')], []))).toEqual([]);
  });

  it('paires consécutives d’étapes et de séjours', () => {
    const items = dayTimeline('2026-07-10', [step('a', 'a0'), step('b', 'a1')], [stay]);
    expect(keys(items)).toEqual(['stay:h1:2026-07-10:start>a', 'a>b', 'b>stay:h1:2026-07-10:end']);
  });

  it('dossiers : trajets vers le premier enfant, entre enfants, depuis le dernier', () => {
    const steps = [
      step('a', 'a0'),
      step('g', 'a1', { kind: 'group', type: null, lat: null, lng: null }),
      step('g1', 'a0', { parentId: 'g' }),
      step('g2', 'a1', { parentId: 'g' }),
      step('b', 'a2'),
    ];
    expect(keys(dayTimeline('2026-07-12', steps, []))).toEqual(['a>g1', 'g1>g2', 'g2>b']);
  });

  it('un dossier vide ne crée pas de trajet', () => {
    const steps = [
      step('a', 'a0'),
      step('g', 'a1', { kind: 'group', type: null, lat: null, lng: null }),
      step('b', 'a2'),
    ];
    expect(keys(dayTimeline('2026-07-12', steps, []))).toEqual(['a>b']);
  });

  it('part du point de sortie de l’étape précédente (randonnée) vers l’entrée de la suivante', () => {
    const hike = step('rando', 'a0', {
      type: 'hike',
      lat: 45.9,
      lng: 6.1,
      exitLat: 45.95,
      exitLng: 6.2,
    });
    const next = step('b', 'a1', { lat: 46, lng: 6.3, exitLat: 46.1, exitLng: 6.4 });
    const [leg] = requiredLegs(dayTimeline('2026-07-12', [hike, next], []));
    expect(leg!.from).toEqual({ lat: 45.95, lng: 6.2 });
    expect(leg!.to).toEqual({ lat: 46, lng: 6.3 });
  });
});

describe('trajets du voyage et trajets caducs', () => {
  const days = [
    { id: 'd1', date: '2026-07-10' },
    { id: 'd2', date: '2026-07-11' },
  ];

  it('rassemble les paires requises de tous les jours', () => {
    const steps = [step('a', 'a0'), step('b', 'a1'), step('c', 'a0', { dayId: 'd2' })];
    const required = tripRequiredLegKeys(days, steps, []);
    expect([...required].sort()).toEqual([legPairKey('a', 'b')]);
  });

  it('détecte les trajets dont la paire n’est plus consécutive après un réordonnancement', () => {
    const before = [step('a', 'a0'), step('b', 'a1'), step('c', 'a2')];
    const legs = [
      { id: 'l1', fromKey: 'a', toKey: 'b' },
      { id: 'l2', fromKey: 'b', toKey: 'c' },
    ];
    expect(staleLegs(legs, tripRequiredLegKeys(days, before, []))).toEqual([]);
    // c passe en tête : c, a, b.
    const after = [step('a', 'a1'), step('b', 'a2'), step('c', 'a0')];
    expect(staleLegs(legs, tripRequiredLegKeys(days, after, [])).map((l) => l.id)).toEqual(['l2']);
  });
});
