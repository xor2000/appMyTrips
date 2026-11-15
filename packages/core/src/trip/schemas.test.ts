import { describe, expect, it } from 'vitest';
import {
  DayPatch,
  IsoDate,
  MAX_TRIP_DAYS,
  Role,
  TimeOfDay,
  TripCreate,
  TripPatch,
} from './schemas';

describe('IsoDate', () => {
  it('accepte une date AAAA-MM-JJ valide', () => {
    expect(IsoDate.parse('2028-02-29')).toBe('2028-02-29');
  });

  it('refuse une date inexistante ou mal formée', () => {
    for (const v of ['2027-02-29', '2026-13-01', '2026-7-1', '10/07/2026', '']) {
      expect(IsoDate.safeParse(v).success, v).toBe(false);
    }
  });
});

describe('TimeOfDay', () => {
  it('accepte HH:mm de 00:00 à 23:59', () => {
    expect(TimeOfDay.parse('00:00')).toBe('00:00');
    expect(TimeOfDay.parse('23:59')).toBe('23:59');
  });

  it('refuse une heure invalide', () => {
    for (const v of ['24:00', '8:00', '08:60', '0800']) {
      expect(TimeOfDay.safeParse(v).success, v).toBe(false);
    }
  });
});

describe('Role', () => {
  it('ne connaît que viewer et editor', () => {
    expect(Role.options).toEqual(['viewer', 'editor']);
    expect(Role.safeParse('owner').success).toBe(false);
  });
});

describe('TripCreate', () => {
  const base = { name: 'Voyage test Alpes', startDate: '2026-07-10', endDate: '2026-07-12' };

  it('applique les valeurs par défaut', () => {
    expect(TripCreate.parse(base)).toEqual({
      ...base,
      dayStart: '08:00',
      dayEnd: '22:00',
      defaultTimezone: 'Europe/Paris',
      hikeSpeedKmh: 3.5,
    });
  });

  it('nettoie le nom et refuse un nom vide', () => {
    expect(TripCreate.parse({ ...base, name: '  Alpes  ' }).name).toBe('Alpes');
    expect(TripCreate.safeParse({ ...base, name: '   ' }).success).toBe(false);
  });

  it('refuse une fin avant le début', () => {
    expect(TripCreate.safeParse({ ...base, endDate: '2026-07-09' }).success).toBe(false);
  });

  it(`refuse une période de plus de ${MAX_TRIP_DAYS} jours`, () => {
    expect(TripCreate.safeParse({ ...base, endDate: '2026-12-31' }).success).toBe(false);
  });

  it('refuse une fin de journée avant son début', () => {
    expect(TripCreate.safeParse({ ...base, dayStart: '22:00', dayEnd: '08:00' }).success).toBe(
      false,
    );
  });

  it('refuse un fuseau horaire inconnu', () => {
    expect(TripCreate.safeParse({ ...base, defaultTimezone: 'Mars/Olympus' }).success).toBe(false);
  });
});

describe('TripPatch', () => {
  it('accepte une modification partielle', () => {
    expect(TripPatch.parse({ name: 'Nouveau nom' })).toEqual({ name: 'Nouveau nom' });
  });

  it('exige les deux dates ensemble', () => {
    expect(TripPatch.safeParse({ startDate: '2026-07-10' }).success).toBe(false);
    expect(TripPatch.safeParse({ startDate: '2026-07-10', endDate: '2026-07-11' }).success).toBe(
      true,
    );
  });

  it('refuse un objet vide', () => {
    expect(TripPatch.safeParse({}).success).toBe(false);
  });
});

describe('DayPatch', () => {
  it('accepte des notes et des heures propres au jour, ou null pour revenir à celles du voyage', () => {
    expect(DayPatch.parse({ notes: 'Marché le matin', dayStart: '07:00', dayEnd: null })).toEqual({
      notes: 'Marché le matin',
      dayStart: '07:00',
      dayEnd: null,
    });
  });

  it('refuse un objet vide', () => {
    expect(DayPatch.safeParse({}).success).toBe(false);
  });
});
