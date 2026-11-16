import { describe, expect, it } from 'vitest';
import invalid from '../../test/fixtures/invalid.gpx?raw';
import linear from '../../test/fixtures/linear.gpx?raw';
import loop from '../../test/fixtures/loop.gpx?raw';
import multiseg from '../../test/fixtures/multiseg.gpx?raw';
import noele from '../../test/fixtures/noele.gpx?raw';
import route from '../../test/fixtures/route.gpx?raw';
import single from '../../test/fixtures/single.gpx?raw';
import { haversineM } from '../leg/geo';
import {
  GpxData,
  GpxError,
  elevationProfile,
  gpxStats,
  hikeDurationMin,
  parseGpx,
  prepareGpx,
  simplifyTrack,
} from './gpx';

/** GPX d'exemple (générés par test/fixtures/generate-gpx.mjs), importés en texte par Vite. */
const FIXTURES: Record<string, string> = {
  'invalid.gpx': invalid,
  'linear.gpx': linear,
  'loop.gpx': loop,
  'multiseg.gpx': multiseg,
  'noele.gpx': noele,
  'route.gpx': route,
  'single.gpx': single,
};
const fixture = (name: string) => FIXTURES[name]!;

const within = (actual: number, expected: number, tolerance: number) =>
  Math.abs(actual - expected) / expected <= tolerance;

describe('parseGpx', () => {
  it('lit les points d’une trace (trk/trkseg/trkpt), avec altitude et nom', () => {
    const gpx = parseGpx(fixture('loop.gpx'));
    expect(gpx.name).toBe('Tournette (test)');
    expect(gpx.points).toHaveLength(400);
    expect(gpx.points[0]).toEqual({
      lat: expect.any(Number),
      lng: expect.any(Number),
      ele: expect.any(Number),
    });
  });

  it('nom du fichier : métadonnées si la trace n’en a pas', () => {
    expect(parseGpx(fixture('linear.gpx')).name).toBe('Tour test');
  });

  it('sans altitude : ele vaut null', () => {
    expect(parseGpx(fixture('noele.gpx')).points[0]!.ele).toBeNull();
  });

  it('concatène plusieurs segments dans l’ordre', () => {
    const multi = parseGpx(fixture('multiseg.gpx')).points;
    expect(multi).toEqual(parseGpx(fixture('linear.gpx')).points);
  });

  it('à défaut de trace, lit un itinéraire (rte/rtept)', () => {
    const route = parseGpx(fixture('route.gpx'));
    expect(route.points).toHaveLength(3);
    expect(route.name).toBe('Itinéraire');
  });

  it('refuse un fichier invalide, vide ou d’un seul point', () => {
    expect(() => parseGpx(fixture('invalid.gpx'))).toThrow(GpxError);
    expect(() => parseGpx('')).toThrow(/GPX/);
    expect(() => parseGpx('<html></html>')).toThrow(/GPX/);
    try {
      parseGpx(fixture('single.gpx'));
      throw new Error('aurait dû échouer');
    } catch (e) {
      expect(e).toBeInstanceOf(GpxError);
      expect((e as GpxError).code).toBe('too_few_points');
    }
  });
});

describe('gpxStats', () => {
  it('boucle : 12,4 km, D+ et D− de 620 m (bruit lissé), boucle détectée', () => {
    const stats = gpxStats(parseGpx(fixture('loop.gpx')).points);
    expect(within(stats.distanceM, 12_400, 0.01)).toBe(true);
    expect(within(stats.ascentM!, 620, 0.05)).toBe(true);
    expect(within(stats.descentM!, 620, 0.05)).toBe(true);
    expect(stats.isLoop).toBe(true);
    expect(stats.pointCount).toBe(400);
    expect(stats.minEle).toBeLessThan(1002);
    expect(stats.maxEle).toBeGreaterThan(1618);
  });

  it('parcours linéaire : distance, D+ 300 m, pas de D−, pas une boucle', () => {
    const points = parseGpx(fixture('linear.gpx')).points;
    const stats = gpxStats(points);
    const straight = haversineM(points[0]!, points[points.length - 1]!);
    expect(within(stats.distanceM, straight, 0.01)).toBe(true);
    expect(within(stats.ascentM!, 300, 0.05)).toBe(true);
    expect(stats.descentM).toBe(0);
    expect(stats.isLoop).toBe(false);
  });

  it('sans altitude : D+ et D− inconnus', () => {
    const stats = gpxStats(parseGpx(fixture('noele.gpx')).points);
    expect(stats.ascentM).toBeNull();
    expect(stats.descentM).toBeNull();
    expect(stats.minEle).toBeNull();
  });
});

describe('hikeDurationMin', () => {
  const stats = { distanceM: 12_400, ascentM: 620 };

  it('distance à la vitesse du voyage, arrondie aux 5 min (12,4 km à 3,5 km/h → 3 h 35)', () => {
    expect(hikeDurationMin(stats, 3.5, false)).toBe(215);
  });

  it('avec le dénivelé : + 1 h par 600 m de D+ (620 m → + 1 h 02)', () => {
    // 212,6 min + 62 min = 274,6 → 275.
    expect(hikeDurationMin(stats, 3.5, true)).toBe(275);
  });

  it('vitesse du voyage modifiée', () => {
    expect(hikeDurationMin(stats, 5, false)).toBe(150);
  });

  it('dénivelé inconnu : ignoré', () => {
    expect(hikeDurationMin({ distanceM: 12_400, ascentM: null }, 3.5, true)).toBe(215);
  });
});

describe('simplifyTrack', () => {
  it('500 points au plus, départ et arrivée conservés', () => {
    const many = Array.from({ length: 3000 }, (_, i) => ({
      lat: 45.9 + i * 0.0001,
      lng: 6.1 + Math.sin(i / 30) * 0.01,
      ele: 1000 + i / 10,
    }));
    const simple = simplifyTrack(many, 500);
    expect(simple.length).toBeLessThanOrEqual(500);
    expect(simple.length).toBeGreaterThan(50);
    expect(simple[0]).toEqual(many[0]);
    expect(simple[simple.length - 1]).toEqual(many[many.length - 1]);
  });

  it('une trace courte est gardée telle quelle', () => {
    const points = parseGpx(fixture('linear.gpx')).points;
    expect(simplifyTrack(points, 500)).toEqual(points);
  });
});

describe('prepareGpx et profil', () => {
  it('prépare les données envoyées à l’API : statistiques et tracé simplifié valides', () => {
    const data = prepareGpx(fixture('loop.gpx'));
    expect(data.name).toBe('Tournette (test)');
    expect(GpxData.safeParse(data.gpx).success).toBe(true);
    expect(data.gpx.track.length).toBeLessThanOrEqual(500);
    expect(data.gpx.track[0]).toHaveLength(3);
  });

  it('profil altimétrique : distance cumulée et altitude, vide sans altitude', () => {
    const profile = elevationProfile(prepareGpx(fixture('linear.gpx')).gpx.track);
    expect(profile[0]).toEqual({ distanceM: 0, ele: 500 });
    expect(profile[profile.length - 1]!.ele).toBeCloseTo(800, 0);
    expect(elevationProfile(prepareGpx(fixture('noele.gpx')).gpx.track)).toEqual([]);
  });

  it('GpxData refuse un tracé trop long ou trop court', () => {
    const stats = prepareGpx(fixture('linear.gpx')).gpx.stats;
    expect(GpxData.safeParse({ stats, track: [[45, 6, null]] }).success).toBe(false);
    expect(
      GpxData.safeParse({ stats, track: Array.from({ length: 501 }, () => [45, 6, null]) }).success,
    ).toBe(false);
  });
});
