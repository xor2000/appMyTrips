import { describe, expect, it } from 'vitest';
import { LegCreate, LegPatch, RouteRequest, estimatedDeparture, zonedTimeToUtc } from './schemas';

describe('schémas de trajet', () => {
  it('LegCreate : paire, mode, saisies facultatives', () => {
    const leg = LegCreate.parse({ fromKey: 'a', toKey: 'b', mode: 'car' });
    expect(leg).toEqual({ fromKey: 'a', toKey: 'b', mode: 'car', notes: '' });
    expect(LegCreate.safeParse({ fromKey: 'a', toKey: 'b', mode: 'rocket' }).success).toBe(false);
    expect(
      LegCreate.safeParse({ fromKey: 'a', toKey: 'b', mode: 'car', durationMin: -5 }).success,
    ).toBe(false);
    expect(
      LegCreate.safeParse({ fromKey: 'a', toKey: 'a', mode: 'car' }).success,
      'départ et arrivée identiques',
    ).toBe(false);
  });

  it('LegPatch : null remet la valeur au routeur ; au moins un champ', () => {
    expect(LegPatch.parse({ durationMin: null })).toEqual({ durationMin: null });
    expect(LegPatch.parse({ recompute: true })).toEqual({ recompute: true });
    expect(LegPatch.safeParse({}).success).toBe(false);
    expect(LegPatch.safeParse({ departAt: '25:00' }).success).toBe(false);
  });

  it('couleur : rang dans la palette (0 à 7), facultative ; null la remet en automatique', () => {
    expect(LegCreate.parse({ fromKey: 'a', toKey: 'b', mode: 'car', color: 3 }).color).toBe(3);
    expect(LegCreate.safeParse({ fromKey: 'a', toKey: 'b', mode: 'car', color: 8 }).success).toBe(
      false,
    );
    expect(LegPatch.parse({ color: 0 })).toEqual({ color: 0 });
    expect(LegPatch.parse({ color: null })).toEqual({ color: null });
    expect(LegPatch.safeParse({ color: -1 }).success).toBe(false);
    expect(LegPatch.safeParse({ color: 1.5 }).success).toBe(false);
  });

  it('RouteRequest : mode, points et départ facultatif (date-heure ISO)', () => {
    const ok = RouteRequest.safeParse({
      mode: 'train',
      from: { lat: 45.76, lng: 4.86 },
      to: { lat: 45.19, lng: 5.71 },
      departAt: '2026-07-10T07:00:00.000Z',
    });
    expect(ok.success).toBe(true);
    expect(
      RouteRequest.safeParse({ mode: 'car', from: { lat: 95, lng: 0 }, to: { lat: 0, lng: 0 } })
        .success,
    ).toBe(false);
  });
});

describe('heures', () => {
  it('convertit une heure locale d’un fuseau en instant UTC (été et hiver)', () => {
    expect(zonedTimeToUtc('2026-07-10', '09:00', 'Europe/Paris')).toBe('2026-07-10T07:00:00.000Z');
    expect(zonedTimeToUtc('2026-01-10', '09:00', 'Europe/Paris')).toBe('2026-01-10T08:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-10', '09:00', 'America/New_York')).toBe(
      '2026-07-10T13:00:00.000Z',
    );
  });

  it('fuseau inconnu : UTC', () => {
    expect(zonedTimeToUtc('2026-07-10', '09:00', 'Pas/UnFuseau')).toBe('2026-07-10T09:00:00.000Z');
  });

  it('départ estimé : heure fixée du trajet, sinon fin de l’étape précédente si son heure est fixe, sinon 09:00', () => {
    expect(
      estimatedDeparture({ departAt: '14:10' }, { fixedStart: '10:00', durationMin: 90 }),
    ).toBe('14:10');
    expect(estimatedDeparture({ departAt: null }, { fixedStart: '10:00', durationMin: 90 })).toBe(
      '11:30',
    );
    expect(estimatedDeparture({ departAt: null }, { fixedStart: '23:30', durationMin: 90 })).toBe(
      '23:59',
    );
    expect(estimatedDeparture({ departAt: null }, { fixedStart: null, durationMin: 90 })).toBe(
      '09:00',
    );
    expect(estimatedDeparture({ departAt: null }, null)).toBe('09:00');
  });
});
