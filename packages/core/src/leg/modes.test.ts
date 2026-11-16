import { describe, expect, it } from 'vitest';
import { LEG_MODES, LEG_MODE_INFO, durationAtSpeed, legValues, localRoute } from './modes';
import { decodePolyline, haversineM } from './geo';

describe('modes de trajet', () => {
  it('chaque mode a un libellé, une couleur et une vitesse moyenne', () => {
    for (const mode of LEG_MODES) {
      const info = LEG_MODE_INFO[mode];
      expect(info.label, mode).toBeTruthy();
      expect(info.color, mode).toMatch(/^--type-/);
      expect(info.speedKmh, mode).toBeGreaterThan(0);
    }
  });

  it('vitesses moyennes du plan', () => {
    expect(LEG_MODE_INFO.car.speedKmh).toBe(60);
    expect(LEG_MODE_INFO.bike.speedKmh).toBe(15);
    expect(LEG_MODE_INFO.walk.speedKmh).toBe(4.5);
    expect(LEG_MODE_INFO.bus.speedKmh).toBe(30);
    expect(LEG_MODE_INFO.train.speedKmh).toBe(80);
    expect(LEG_MODE_INFO.plane.speedKmh).toBe(750);
    expect(LEG_MODE_INFO.ferry.speedKmh).toBe(30);
  });

  it('durée à la vitesse du mode, arrondie à la minute (au moins 1)', () => {
    expect(durationAtSpeed('car', 60_000)).toBe(60);
    expect(durationAtSpeed('walk', 4_500)).toBe(60);
    expect(durationAtSpeed('bike', 10)).toBe(1);
  });
});

const ANNECY = { lat: 45.8992, lng: 6.1294 };
const CHAMONIX = { lat: 45.9237, lng: 6.8694 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const LISBONNE = { lat: 38.7223, lng: -9.1393 };

describe('localRoute', () => {
  it('avion : grand cercle, distance ÷ 750 km/h + 30 min, tracé en arc', () => {
    const r = localRoute('plane', PARIS, LISBONNE);
    const km = haversineM(PARIS, LISBONNE) / 1000;
    expect(r.source).toBe('router');
    expect(r.distanceM).toBe(Math.round(km * 1000));
    expect(r.durationMin).toBe(Math.round((km / 750) * 60) + 30);
    const arc = decodePolyline(r.geometry, 5);
    expect(arc.length).toBeGreaterThan(10);
    expect(arc[0]!.lat).toBeCloseTo(PARIS.lat, 4);
  });

  it('ferry : grand cercle à 30 km/h', () => {
    const r = localRoute('ferry', PARIS, LISBONNE);
    expect(r.source).toBe('router');
    expect(r.durationMin).toBe(durationAtSpeed('ferry', r.distanceM));
  });

  it('autres modes : estimation (grand cercle × 1,3 à la vitesse du mode), ligne droite', () => {
    const r = localRoute('car', ANNECY, CHAMONIX);
    const expected = Math.round(haversineM(ANNECY, CHAMONIX) * 1.3);
    expect(r.source).toBe('estimate');
    expect(r.distanceM).toBe(expected);
    expect(r.durationMin).toBe(durationAtSpeed('car', expected));
    expect(decodePolyline(r.geometry, 5)).toHaveLength(2);
    expect(r.summary).toBeNull();
  });
});

describe('legValues : priorité saisie manuelle / routeur', () => {
  const routed = { distanceM: 72_000, durationMin: 75, source: 'router' as const };

  it('sans saisie : valeurs du routeur', () => {
    expect(legValues('car', routed, {})).toEqual({
      distanceM: 72_000,
      durationMin: 75,
      distanceSource: 'router',
      durationSource: 'router',
    });
  });

  it('durée forcée : gardée, la distance reste celle du routeur', () => {
    expect(legValues('car', routed, { durationMin: 45 })).toEqual({
      distanceM: 72_000,
      durationMin: 45,
      distanceSource: 'router',
      durationSource: 'manual',
    });
  });

  it('distance forcée sans durée : durée recalculée à la vitesse du mode', () => {
    expect(legValues('bike', routed, { distanceM: 30_000 })).toEqual({
      distanceM: 30_000,
      durationMin: 120,
      distanceSource: 'manual',
      durationSource: 'manual',
    });
  });

  it('distance et durée forcées : les deux gardées', () => {
    expect(legValues('car', routed, { distanceM: 80_000, durationMin: 50 })).toMatchObject({
      distanceM: 80_000,
      durationMin: 50,
      distanceSource: 'manual',
      durationSource: 'manual',
    });
  });

  it('estimation locale : sources « estimate »', () => {
    expect(
      legValues('car', { distanceM: 10_000, durationMin: 10, source: 'estimate' }, {}),
    ).toMatchObject({ distanceSource: 'estimate', durationSource: 'estimate' });
  });

  it('sans itinéraire : la durée manuelle seule suffit, distance inconnue', () => {
    expect(legValues('train', null, { durationMin: 95 })).toEqual({
      distanceM: null,
      durationMin: 95,
      distanceSource: 'manual',
      durationSource: 'manual',
    });
  });

  it('sans itinéraire ni durée : impossible (null)', () => {
    expect(legValues('train', null, {})).toBeNull();
  });
});
