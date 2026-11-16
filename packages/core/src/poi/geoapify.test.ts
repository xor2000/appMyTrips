import { describe, expect, it } from 'vitest';
import { geoapifyParams, poisFromGeoapify } from './geoapify';

describe('geoapifyParams', () => {
  it('donne les catégories Geoapify et le filtre rectangle (ouest,sud,est,nord)', () => {
    const params = geoapifyParams({ west: 2.3, south: 48.84, east: 2.38, north: 48.88 }, [
      'museum',
      'viewpoint',
    ]);
    expect(params.categories.split(',')).toEqual(
      expect.arrayContaining(['entertainment.museum', 'tourism.attraction.viewpoint']),
    );
    expect(params.filter).toBe('rect:2.3,48.84,2.38,48.88');
    expect(params.limit).toBe('500');
    expect(params.lang).toBe('fr');
  });
});

describe('poisFromGeoapify', () => {
  it('normalise les lieux, avec la référence OSM et les tags bruts', () => {
    const json = {
      features: [
        {
          properties: {
            name: 'Musée du Louvre',
            lat: 48.8606,
            lon: 2.3376,
            place_id: 'abc',
            categories: ['entertainment', 'entertainment.museum'],
            address_line2: 'Rue de Rivoli, 75001 Paris, France',
            datasource: {
              raw: {
                osm_type: 'w',
                osm_id: 1234,
                opening_hours: 'Mo 09:00-18:00',
                website: 'https://www.louvre.fr',
                wikidata: 'Q19675',
                wikipedia: 'fr:Musée du Louvre',
              },
            },
          },
        },
        {
          properties: {
            name: 'Café sans OSM',
            lat: 48.85,
            lon: 2.35,
            place_id: 'xyz',
            categories: ['catering.cafe'],
            contact: { phone: '+33 1 00 00 00 00' },
            catering: { cuisine: 'coffee_shop' },
          },
        },
        // Sans nom : ignoré.
        { properties: { lat: 48.85, lon: 2.35, categories: ['catering.cafe'] } },
        // Catégorie non demandée : ignoré.
        { properties: { name: 'Plage', lat: 1, lon: 1, categories: ['beach'] } },
      ],
    };
    expect(poisFromGeoapify(json, ['museum', 'cafe'])).toEqual([
      {
        id: 'osm:W1234',
        osmRef: 'W1234',
        name: 'Musée du Louvre',
        category: 'museum',
        stepType: 'museum',
        lat: 48.8606,
        lng: 2.3376,
        address: 'Rue de Rivoli, 75001 Paris, France',
        openingHours: 'Mo 09:00-18:00',
        website: 'https://www.louvre.fr',
        phone: null,
        cuisine: null,
        wikidata: 'Q19675',
        wikipedia: 'fr:Musée du Louvre',
        source: 'geoapify',
      },
      {
        id: 'geoapify:xyz',
        osmRef: null,
        name: 'Café sans OSM',
        category: 'cafe',
        stepType: 'cafe',
        lat: 48.85,
        lng: 2.35,
        address: null,
        openingHours: null,
        website: null,
        phone: '+33 1 00 00 00 00',
        cuisine: 'coffee_shop',
        wikidata: null,
        wikipedia: null,
        source: 'geoapify',
      },
    ]);
  });

  it('tolère une réponse vide ou mal formée', () => {
    expect(poisFromGeoapify({}, ['museum'])).toEqual([]);
    expect(poisFromGeoapify(undefined, ['museum'])).toEqual([]);
  });
});
