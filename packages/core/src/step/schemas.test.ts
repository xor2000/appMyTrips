import { describe, expect, it } from 'vitest';
import { StayCreate, StayPatch, StepCreate, StepPatch } from './schemas';

const point = { lat: 45.9, lng: 6.3 };

describe('StepCreate', () => {
  it('applique la durée par défaut du type', () => {
    const s = StepCreate.parse({ dayId: null, type: 'museum', name: 'MuCEM', ...point });
    expect(s).toMatchObject({ kind: 'step', durationMin: 120, fixedStart: null, parentId: null });
  });

  it('garde une durée explicite, même nulle', () => {
    expect(
      StepCreate.parse({ dayId: null, type: 'museum', name: 'X', durationMin: 0, ...point })
        .durationMin,
    ).toBe(0);
  });

  it('exige des coordonnées valides pour une étape', () => {
    expect(StepCreate.safeParse({ dayId: null, type: 'museum', name: 'X' }).success).toBe(false);
    expect(
      StepCreate.safeParse({ dayId: null, type: 'museum', name: 'X', lat: 91, lng: 0 }).success,
    ).toBe(false);
    expect(
      StepCreate.safeParse({ dayId: null, type: 'museum', name: 'X', lat: 0, lng: 181 }).success,
    ).toBe(false);
  });

  it('accepte un dossier sans coordonnées ni type', () => {
    const g = StepCreate.parse({ dayId: null, kind: 'group', name: 'Vieux-Port' });
    expect(g).toMatchObject({ kind: 'group', type: null, durationMin: 0 });
  });

  it('refuse un type inconnu, un nom vide, une durée négative et une heure fixe invalide', () => {
    const base = { dayId: null, name: 'X', ...point };
    expect(StepCreate.safeParse({ ...base, type: 'volcan' }).success).toBe(false);
    expect(StepCreate.safeParse({ ...base, type: 'museum', name: ' ' }).success).toBe(false);
    expect(StepCreate.safeParse({ ...base, type: 'museum', durationMin: -5 }).success).toBe(false);
    expect(StepCreate.safeParse({ ...base, type: 'museum', fixedStart: '25:00' }).success).toBe(
      false,
    );
  });

  it('refuse un lien de réservation qui n’est pas http(s)', () => {
    const base = { dayId: null, type: 'restaurant', name: 'X', ...point };
    expect(StepCreate.safeParse({ ...base, bookingUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(StepCreate.safeParse({ ...base, bookingUrl: 'https://resa.fr/123' }).success).toBe(true);
  });
});

describe('StepPatch', () => {
  it('accepte un déplacement (jour, dossier, position)', () => {
    expect(StepPatch.parse({ dayId: null, parentId: null, position: 'a1' })).toEqual({
      dayId: null,
      parentId: null,
      position: 'a1',
    });
  });

  it('accepte de retirer l’heure fixe', () => {
    expect(StepPatch.parse({ fixedStart: null })).toEqual({ fixedStart: null });
  });

  it('refuse un objet vide', () => {
    expect(StepPatch.safeParse({}).success).toBe(false);
  });
});

describe('StayCreate', () => {
  const base = { name: 'Chalet', ...point, checkInDate: '2026-07-10', checkOutDate: '2026-07-12' };

  it('applique les heures par défaut', () => {
    expect(StayCreate.parse(base)).toMatchObject({ checkInTime: '17:00', checkOutTime: '10:00' });
  });

  it('exige au moins une nuit', () => {
    expect(StayCreate.safeParse({ ...base, checkOutDate: '2026-07-10' }).success).toBe(false);
  });
});

describe('StayPatch', () => {
  it('exige les deux dates ensemble', () => {
    expect(StayPatch.safeParse({ checkInDate: '2026-07-10' }).success).toBe(false);
    expect(StayPatch.safeParse({ name: 'Hôtel' }).success).toBe(true);
  });
});
