import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline, greatCircleArc, haversineM } from './geo';

const PARIS = { lat: 48.8566, lng: 2.3522 };
const NEW_YORK = { lat: 40.7128, lng: -74.006 };

describe('géodésie', () => {
  it('distance en grand cercle Paris – New York ≈ 5 837 km (à 1 % près)', () => {
    const km = haversineM(PARIS, NEW_YORK) / 1000;
    expect(Math.abs(km - 5837) / 5837).toBeLessThan(0.01);
  });

  it('distance nulle entre un point et lui-même', () => {
    expect(haversineM(PARIS, PARIS)).toBe(0);
  });

  it('arc géodésique : extrémités exactes, points intermédiaires au nord de la droite', () => {
    const arc = greatCircleArc(PARIS, NEW_YORK, 16);
    expect(arc).toHaveLength(17);
    expect(arc[0]).toEqual(PARIS);
    expect(arc[16]!.lat).toBeCloseTo(NEW_YORK.lat, 6);
    expect(arc[16]!.lng).toBeCloseTo(NEW_YORK.lng, 6);
    // Un grand cercle entre deux villes de l'hémisphère nord passe plus au nord.
    expect(arc[8]!.lat).toBeGreaterThan((PARIS.lat + NEW_YORK.lat) / 2 + 5);
  });

  it('encode et décode une polyligne (précision 5 et 6)', () => {
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    // Exemple de référence de l'algorithme de Google.
    expect(encodePolyline(points, 5)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual(points);
    const six = encodePolyline(points, 6);
    expect(decodePolyline(six, 6)).toEqual(points);
  });

  it('décode une polyligne vide', () => {
    expect(decodePolyline('', 5)).toEqual([]);
  });
});
