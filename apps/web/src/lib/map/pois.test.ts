import type { Poi } from '@mytrips/core';
import { describe, expect, it } from 'vitest';
import { closestPoiId, POI_LAYER, poiFeatureCollection, poiLayer, POI_SOURCE } from './pois';

function poi(id: string, overrides: Partial<Poi> = {}): Poi {
  return {
    id,
    osmRef: null,
    name: `Lieu ${id}`,
    category: 'museum',
    stepType: 'museum',
    lat: 48.86,
    lng: 2.33,
    address: null,
    openingHours: null,
    website: null,
    phone: null,
    cuisine: null,
    wikidata: null,
    wikipedia: null,
    source: 'overpass',
    ...overrides,
  };
}

describe('poiFeatureCollection', () => {
  it('un point par lieu, avec son identifiant, son nom et la couleur de son type', () => {
    const collection = poiFeatureCollection(
      [poi('osm:N1', { lat: 48.1, lng: 2.1 }), poi('osm:N2', { stepType: 'restaurant' })],
      (p) => (p.stepType === 'museum' ? '#111111' : '#222222'),
    );
    expect(collection.features).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2.1, 48.1] },
        properties: { id: 'osm:N1', name: 'Lieu osm:N1', color: '#111111' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2.33, 48.86] },
        properties: { id: 'osm:N2', name: 'Lieu osm:N2', color: '#222222' },
      },
    ]);
  });

  it('aucun lieu : collection vide', () => {
    expect(poiFeatureCollection([], () => '#000').features).toEqual([]);
  });
});

describe('poiLayer', () => {
  it('cercles de la source des lieux, plus grands et opaques quand le lieu est actif', () => {
    const layer = poiLayer('#ffffff');
    expect(layer).toMatchObject({ id: POI_LAYER, type: 'circle', source: POI_SOURCE });
    const radius = JSON.stringify(layer.paint?.['circle-radius']);
    expect(radius).toContain('feature-state');
    expect(radius).toContain('active');
    expect(layer.paint?.['circle-stroke-color']).toBe('#ffffff');
  });
});

describe('closestPoiId', () => {
  const project = ([lng, lat]: [number, number]) => ({ x: lng * 100, y: lat * 100 });

  it('retient le lieu le plus proche du clic parmi ceux sous le curseur', () => {
    const hits = [
      { id: 'loin', lng: 1.05, lat: 1.0 },
      { id: 'pres', lng: 1.01, lat: 1.0 },
    ];
    expect(closestPoiId(hits, { x: 100, y: 100 }, project)).toBe('pres');
  });

  it('aucun lieu sous le curseur : null', () => {
    expect(closestPoiId([], { x: 0, y: 0 }, project)).toBeNull();
  });
});
