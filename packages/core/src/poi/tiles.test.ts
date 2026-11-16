import { describe, expect, it } from 'vitest';
import { bboxCenter, parseBbox, pointInBbox, tileBbox, tileOf, tilesForBbox } from './tiles';

describe('tuiles de cache', () => {
  it('tileOf et tileBbox sont cohérents : la case contient son point', () => {
    const point = { lat: 48.8606, lng: 2.3376 };
    const tile = tileOf(point.lat, point.lng, 13);
    expect(tile).toEqual({ x: 4149, y: 2818 });
    const box = tileBbox(tile.x, tile.y, 13);
    expect(pointInBbox(point, box)).toBe(true);
    expect(box.west).toBeLessThan(box.east);
    expect(box.south).toBeLessThan(box.north);
  });

  it('une petite zone tient dans une seule case', () => {
    const tiles = tilesForBbox({ west: 2.336, south: 48.86, east: 2.338, north: 48.861 }, 13);
    expect(tiles).toEqual([{ x: 4149, y: 2818 }]);
  });

  it('une zone plus grande couvre toutes les cases qu’elle touche', () => {
    const box = { west: 2.3, south: 48.84, east: 2.38, north: 48.88 };
    const tiles = tilesForBbox(box, 13);
    const xs = new Set(tiles.map((t) => t.x));
    const ys = new Set(tiles.map((t) => t.y));
    expect(tiles.length).toBe(xs.size * ys.size);
    expect(tiles.length).toBeGreaterThan(1);
    // Les coins de la zone sont couverts.
    for (const [lat, lng] of [
      [box.south, box.west],
      [box.north, box.east],
    ] as const) {
      expect(tiles).toContainEqual(tileOf(lat, lng, 13));
    }
  });

  it('centre d’une zone', () => {
    expect(bboxCenter({ west: 2, south: 48, east: 3, north: 49 })).toEqual({ lat: 48.5, lng: 2.5 });
  });
});

describe('parseBbox', () => {
  it('lit « ouest,sud,est,nord »', () => {
    expect(parseBbox('2.3,48.84,2.38,48.88')).toEqual({
      west: 2.3,
      south: 48.84,
      east: 2.38,
      north: 48.88,
    });
  });

  it.each([undefined, '', '1,2,3', 'a,b,c,d', '3,48,2,49', '2,49,3,48', '2,48,3,95', '-200,0,0,1'])(
    'refuse %s',
    (value) => {
      expect(parseBbox(value)).toBeNull();
    },
  );
});
