import { describe, expect, it } from 'vitest';
import type { Leg } from '../leg/schemas';
import type { Stay, Step } from '../step/schemas';
import { resolveDayBounds, scheduleDay, type DayScheduleInput } from './schedule';

let n = 0;
/** Étape de test : nom = identifiant, position dans l'ordre de création. */
function step(id: string, durationMin: number, extra: Partial<Step> = {}): Step {
  n += 1;
  return {
    id,
    dayId: 'd1',
    parentId: null,
    position: `a${String(n).padStart(3, '0')}`,
    kind: 'step',
    type: 'museum',
    name: id,
    lat: 45,
    lng: 6,
    address: null,
    exitLat: null,
    exitLng: null,
    durationMin,
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
    ...extra,
  };
}

function leg(fromKey: string, toKey: string, durationMin: number, extra: Partial<Leg> = {}): Leg {
  return {
    id: `${fromKey}-${toKey}`,
    fromKey,
    toKey,
    mode: 'car',
    distanceM: 1000,
    durationMin,
    distanceSource: 'router',
    durationSource: 'router',
    geometry: null,
    summary: null,
    departAt: null,
    bookingRef: null,
    color: null,
    notes: '',
    computedAt: null,
    ...extra,
  };
}

function input(
  steps: Step[],
  legs: Leg[],
  extra: Partial<DayScheduleInput> = {},
): DayScheduleInput {
  return {
    date: '2026-07-10',
    steps,
    stays: [],
    legs,
    dayStart: '08:00',
    dayEnd: '22:00',
    timezone: 'Europe/Paris',
    ...extra,
  };
}

/** « HH:mm » de début et de fin d'un élément (avec « +1 » au besoin). */
function times(result: ReturnType<typeof scheduleDay>, key: string) {
  const item = result.items.find((i) => i.key === key)!;
  const fmt = (t: { time: string; dayOffset: number }) =>
    t.dayOffset ? `${t.time}+${t.dayOffset}` : t.time;
  return `${fmt(item.start)}→${fmt(item.end)}`;
}

describe('scheduleDay', () => {
  it('jour vide : aucun élément, résumé à zéro', () => {
    const r = scheduleDay(input([], []));
    expect(r.items).toEqual([]);
    expect(r.summary).toEqual({
      onSiteMin: 0,
      travelMin: 0,
      freeMin: 0,
      overrunMin: 0,
      conflictCount: 0,
      lateMin: 0,
    });
  });

  it('enchaînement simple : départ au début du jour, étape, trajet, étape', () => {
    const r = scheduleDay(input([step('a', 120), step('b', 60)], [leg('a', 'b', 35)]));
    expect(times(r, 'a')).toBe('08:00→10:00');
    expect(times(r, 'b')).toBe('10:35→11:35');
    expect(r.legs[0]).toMatchObject({
      key: 'a>b',
      depart: { time: '10:00' },
      arrive: { time: '10:35' },
    });
    expect(r.summary).toMatchObject({ onSiteMin: 180, travelMin: 35, freeMin: 0, overrunMin: 0 });
  });

  it('ancre atteinte en avance : temps libre avant l’heure fixe', () => {
    const r = scheduleDay(
      input([step('a', 60), step('b', 90, { fixedStart: '11:00' })], [leg('a', 'b', 30)]),
    );
    expect(times(r, 'b')).toBe('11:00→12:30');
    const b = r.items.find((i) => i.key === 'b')!;
    expect(b.freeBeforeMin).toBe(90);
    expect(b.issues).toEqual([]);
    expect(r.summary.freeMin).toBe(90);
  });

  it('ancre en retard : conflit avec le retard exact, l’étape garde son heure fixe', () => {
    const r = scheduleDay(
      input([step('a', 180), step('b', 60, { fixedStart: '10:30' })], [leg('a', 'b', 20)]),
    );
    const b = r.items.find((i) => i.key === 'b')!;
    expect(times(r, 'b')).toBe('10:30→11:30');
    expect(b.issues).toEqual([{ kind: 'conflict', lateMin: 50 }]);
    expect(r.summary).toMatchObject({ conflictCount: 1, lateMin: 50 });
  });

  it('deux ancres successives', () => {
    const r = scheduleDay(
      input(
        [
          step('a', 60),
          step('b', 60, { fixedStart: '10:00' }),
          step('c', 60, { fixedStart: '11:00' }),
        ],
        [leg('a', 'b', 15), leg('b', 'c', 15)],
      ),
    );
    expect(times(r, 'b')).toBe('10:00→11:00');
    expect(r.items.find((i) => i.key === 'b')!.freeBeforeMin).toBe(45);
    expect(r.items.find((i) => i.key === 'c')!.issues).toEqual([{ kind: 'conflict', lateMin: 15 }]);
  });

  it('trajet à heure de départ fixée (train réservé) : attente puis départ à l’heure', () => {
    const r = scheduleDay(
      input(
        [step('a', 60), step('b', 60)],
        [leg('a', 'b', 90, { mode: 'train', departAt: '09:40' })],
      ),
    );
    expect(r.legs[0]).toMatchObject({
      depart: { time: '09:40' },
      arrive: { time: '11:10' },
      freeBeforeMin: 40,
    });
    expect(times(r, 'b')).toBe('11:10→12:10');
  });

  it('trajet à départ fixé déjà passé : conflit sur le trajet', () => {
    const r = scheduleDay(
      input([step('a', 120), step('b', 60)], [leg('a', 'b', 30, { departAt: '09:30' })]),
    );
    expect(r.legs[0]!.issues).toEqual([{ kind: 'conflict', lateMin: 30 }]);
    expect(r.summary.conflictCount).toBe(1);
  });

  it('dépassement exact de la fin de journée', () => {
    const r = scheduleDay(
      input([step('a', 600), step('b', 300)], [leg('a', 'b', 54)], { dayEnd: '22:00' }),
    );
    // 08:00 + 10 h + 54 min + 5 h = 23:54.
    expect(times(r, 'b')).toBe('18:54→23:54');
    expect(r.summary.overrunMin).toBe(114);
  });

  it('sans trajet (facultatif) : 0 min, sans signalement', () => {
    const r = scheduleDay(input([step('a', 60), step('b', 60)], []));
    expect(times(r, 'b')).toBe('09:00→10:00');
    expect(r.legs[0]).toMatchObject({ missing: true, durationMin: 0 });
    expect(r.legs[0]!.issues).toEqual([]);
    expect(r.summary).not.toHaveProperty('missingLegs');
  });

  it('dossier : début du premier enfant, fin du dernier', () => {
    const a = step('a', 60);
    const g = step('g', 0, { kind: 'group', type: null, lat: null, lng: null });
    const r = scheduleDay(
      input(
        [a, g, step('g1', 30, { parentId: 'g' }), step('g2', 45, { parentId: 'g' })],
        [leg('a', 'g1', 10), leg('g1', 'g2', 5)],
      ),
    );
    expect(times(r, 'g1')).toBe('09:10→09:40');
    expect(times(r, 'g2')).toBe('09:45→10:30');
    expect(times(r, 'g')).toBe('09:10→10:30');
  });

  it('séjours : départ du matin au début du jour, arrivée du soir, dépassement jusqu’au retour', () => {
    const stay: Stay = {
      id: 'h',
      name: 'Hôtel',
      lat: 45,
      lng: 6,
      address: null,
      checkInDate: '2026-07-09',
      checkInTime: '17:00',
      checkOutDate: '2026-07-12',
      checkOutTime: '10:00',
      bookingRef: null,
      notes: '',
    };
    const start = 'stay:h:2026-07-10:start';
    const end = 'stay:h:2026-07-10:end';
    const r = scheduleDay(
      input([step('a', 600)], [leg(start, 'a', 30), leg('a', end, 30)], {
        stays: [stay],
        dayEnd: '18:00',
      }),
    );
    expect(times(r, start)).toBe('08:00→08:00');
    expect(times(r, 'a')).toBe('08:30→18:30');
    expect(times(r, end)).toBe('19:00→19:00');
    expect(r.summary.overrunMin).toBe(60);
  });

  it('vol Paris 10:00 → New York (8 h 30) : arrivée à 12:30 heure locale', () => {
    const r = scheduleDay(
      input(
        [
          step('cdg', 120, { type: 'airport', fixedStart: '08:00' }),
          step('jfk', 60, { type: 'airport', timezone: 'America/New_York' }),
        ],
        [leg('cdg', 'jfk', 510, { mode: 'plane' })],
      ),
    );
    expect(times(r, 'cdg')).toBe('08:00→10:00');
    expect(times(r, 'jfk')).toBe('12:30→13:30');
    expect(r.items.find((i) => i.key === 'jfk')!.timezone).toBe('America/New_York');
  });

  it('vol de nuit : arrivée le lendemain (+1 j)', () => {
    const r = scheduleDay(
      input(
        [
          step('cdg', 60, { type: 'airport', fixedStart: '20:00' }),
          step('jfk', 30, { type: 'airport', timezone: 'America/New_York' }),
        ],
        [leg('cdg', 'jfk', 600, { mode: 'plane' })],
        { dayEnd: '23:59' },
      ),
    );
    // 21:00 à Paris (19:00 UTC) + 10 h = 05:00 UTC = 01:00 à New York, le lendemain.
    expect(times(r, 'jfk')).toBe('01:00+1→01:30+1');
  });

  it('heure d’été : l’heure fixe reste en heure locale le jour du changement', () => {
    const r = scheduleDay(
      input([step('a', 60, { fixedStart: '10:00' })], [], {
        date: '2026-03-29',
        dayStart: '01:00',
      }),
    );
    expect(times(r, 'a')).toBe('10:00→11:00');
  });

  it('fuseau inconnu : UTC, sans erreur', () => {
    const r = scheduleDay(
      input([step('a', 60, { timezone: 'Pas/UnFuseau' })], [], { timezone: 'Pas/UnFuseau' }),
    );
    expect(times(r, 'a')).toBe('08:00→09:00');
  });
});

describe('resolveDayBounds', () => {
  it('heures du jour si surchargées, sinon celles du voyage', () => {
    const trip = { dayStart: '08:00', dayEnd: '22:00' };
    expect(resolveDayBounds({ dayStart: null, dayEnd: null }, trip)).toEqual(trip);
    expect(resolveDayBounds({ dayStart: '06:30', dayEnd: null }, trip)).toEqual({
      dayStart: '06:30',
      dayEnd: '22:00',
    });
    const r = scheduleDay(
      input([step('a', 60)], [], resolveDayBounds({ dayStart: '06:30', dayEnd: '20:00' }, trip)),
    );
    expect(times(r, 'a')).toBe('06:30→07:30');
  });
});
