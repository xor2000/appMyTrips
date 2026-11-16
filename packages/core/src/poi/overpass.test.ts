import { describe, expect, it } from 'vitest';
import { overpassQuery, poisFromOverpass } from './overpass';

const BOX = { west: 2.3, south: 48.84, east: 2.38, north: 48.88 };

describe('overpassQuery', () => {
  it('construit une requête QL : bbox (sud,ouest,nord,est), lieux nommés, centre des ways', () => {
    const q = overpassQuery(BOX, ['museum']);
    expect(q).toMatch(/^\[out:json\]\[timeout:\d+\];/);
    expect(q).toContain('nwr["tourism"~"^(museum|gallery)$"]["name"](48.84,2.3,48.88,2.38);');
    expect(q.trim()).toMatch(/out center tags;$/);
  });

  it('ajoute une instruction par règle de chaque catégorie demandée', () => {
    const q = overpassQuery(BOX, ['restaurant', 'monument']);
    expect(q).toContain('nwr["amenity"~"^(restaurant|fast_food)$"]');
    expect(q).toContain('nwr["historic"~"^(monument|memorial|castle|ruins|archaeological_site)$"]');
    expect(q).toContain('nwr["tourism"~"^(artwork)$"]');
    expect(q).not.toContain('museum');
  });
});

describe('poisFromOverpass', () => {
  const json = {
    elements: [
      {
        type: 'node',
        id: 1000,
        lat: 48.8606,
        lon: 2.3376,
        tags: {
          name: 'Musée du Louvre',
          tourism: 'museum',
          'addr:housenumber': '99',
          'addr:street': 'Rue de Rivoli',
          'addr:postcode': '75001',
          'addr:city': 'Paris',
          opening_hours: 'Mo,We-Su 09:00-18:00',
          website: 'https://www.louvre.fr',
          phone: '+33 1 40 20 50 50',
          wikidata: 'Q19675',
          wikipedia: 'fr:Musée du Louvre',
        },
      },
      {
        type: 'way',
        id: 42,
        center: { lat: 48.8638, lon: 2.3226 },
        tags: {
          name: 'Le Bistrot',
          amenity: 'restaurant',
          cuisine: 'french',
          'contact:website': 'javascript:alert(1)',
        },
      },
      // Sans nom : ignoré.
      { type: 'node', id: 7, lat: 48.85, lon: 2.35, tags: { amenity: 'cafe' } },
      // Catégorie non demandée : ignoré.
      { type: 'node', id: 8, lat: 48.85, lon: 2.35, tags: { name: 'Plage', natural: 'beach' } },
      // Sans coordonnées : ignoré.
      { type: 'relation', id: 9, tags: { name: 'Sans centre', tourism: 'museum' } },
    ],
  };

  it('normalise les éléments en lieux (nodes et centre des ways)', () => {
    const pois = poisFromOverpass(json, ['museum', 'restaurant']);
    expect(pois).toEqual([
      {
        id: 'osm:N1000',
        osmRef: 'N1000',
        name: 'Musée du Louvre',
        category: 'museum',
        stepType: 'museum',
        lat: 48.8606,
        lng: 2.3376,
        address: '99 Rue de Rivoli, 75001 Paris',
        openingHours: 'Mo,We-Su 09:00-18:00',
        website: 'https://www.louvre.fr',
        phone: '+33 1 40 20 50 50',
        cuisine: null,
        wikidata: 'Q19675',
        wikipedia: 'fr:Musée du Louvre',
        source: 'overpass',
      },
      {
        id: 'osm:W42',
        osmRef: 'W42',
        name: 'Le Bistrot',
        category: 'restaurant',
        stepType: 'restaurant',
        lat: 48.8638,
        lng: 2.3226,
        address: null,
        openingHours: null,
        // Lien non http(s) écarté.
        website: null,
        phone: null,
        cuisine: 'french',
        wikidata: null,
        wikipedia: null,
        source: 'overpass',
      },
    ]);
  });

  it('tolère une réponse vide ou mal formée', () => {
    expect(poisFromOverpass({}, ['museum'])).toEqual([]);
    expect(poisFromOverpass(null, ['museum'])).toEqual([]);
  });
});
