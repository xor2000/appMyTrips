import { POI_TILE_ZOOM, tileBbox, type Bbox, type Poi } from '@mytrips/core';
import { describe, expect, it, vi } from 'vitest';
import { BASEMAP_POI_MIN_ZOOM, basemapPoisClickable, createBasemapPoiFinder } from './basemapPois';

const poi = (id: string, lat: number, lng: number): Poi => ({
  id,
  osmRef: id.replace('osm:', ''),
  name: id,
  category: 'museum',
  stepType: 'museum',
  lat,
  lng,
  address: null,
  openingHours: null,
  website: null,
  phone: null,
  cuisine: null,
  wikidata: null,
  wikipedia: null,
  source: 'overpass',
});

// Case 4149 × 2818 du zoom 13 : centre de Paris (Louvre).
const tile = tileBbox(4149, 2818, POI_TILE_ZOOM);
const near: Bbox = { west: 2.3325, south: 48.8625, east: 2.3335, north: 48.8635 };
const artsDeco = poi('osm:N2001', 48.863, 2.333);
const louvre = poi('osm:N1000', 48.8606, 2.3376);

describe('lieux du fond OSM France', () => {
  it('cliquables seulement sur le fond OSM France, assez zoomé', () => {
    expect(basemapPoisClickable('osmfr', BASEMAP_POI_MIN_ZOOM)).toBe(true);
    expect(basemapPoisClickable('osmfr', BASEMAP_POI_MIN_ZOOM - 0.1)).toBe(false);
    expect(basemapPoisClickable('plan', 18)).toBe(false);
    expect(basemapPoisClickable('topo', 18)).toBe(false);
    expect(basemapPoisClickable('satellite', 18)).toBe(false);
  });

  it('cherche par case du cache de la découverte et ne garde que les lieux sous le clic', async () => {
    const fetchArea = vi.fn(async () => [artsDeco, louvre]);
    const find = createBasemapPoiFinder(fetchArea);
    expect(await find(near, 16)).toEqual([artsDeco]);
    expect(fetchArea).toHaveBeenCalledTimes(1);
    expect(fetchArea).toHaveBeenCalledWith(tile, 16);
  });

  it('une case déjà chargée n’est pas redemandée', async () => {
    const fetchArea = vi.fn(async () => [artsDeco, louvre]);
    const find = createBasemapPoiFinder(fetchArea);
    await find(near, 16);
    const aroundLouvre: Bbox = { west: 2.337, south: 48.86, east: 2.338, north: 48.861 };
    expect(await find(aroundLouvre, 17)).toEqual([louvre]);
    expect(fetchArea).toHaveBeenCalledTimes(1);
  });

  it('clic à cheval sur deux cases : les deux sont demandées', async () => {
    const fetchArea = vi.fn(async (area: Bbox) =>
      area.west === tile.west ? [artsDeco] : [poi('osm:N9', 48.863, tile.east + 0.0001)],
    );
    const find = createBasemapPoiFinder(fetchArea);
    const across: Bbox = {
      west: tile.east - 0.0005,
      south: 48.8625,
      east: tile.east + 0.0005,
      north: 48.8635,
    };
    expect((await find(across, 16)).map((p) => p.id)).toEqual(['osm:N9']);
    expect(fetchArea).toHaveBeenCalledTimes(2);
  });

  it('une erreur n’est pas gardée : la case est redemandée au clic suivant', async () => {
    const fetchArea = vi
      .fn<(area: Bbox, zoom: number) => Promise<Poi[]>>()
      .mockRejectedValueOnce(new Error('poi_unavailable'))
      .mockResolvedValueOnce([artsDeco]);
    const find = createBasemapPoiFinder(fetchArea);
    await expect(find(near, 16)).rejects.toThrow('poi_unavailable');
    expect(await find(near, 16)).toEqual([artsDeco]);
    expect(fetchArea).toHaveBeenCalledTimes(2);
  });

  it('deux clics rapprochés dans la même case : une seule requête', async () => {
    const fetchArea = vi.fn(async () => [artsDeco]);
    const find = createBasemapPoiFinder(fetchArea);
    await Promise.all([find(near, 16), find(near, 16)]);
    expect(fetchArea).toHaveBeenCalledTimes(1);
  });
});
