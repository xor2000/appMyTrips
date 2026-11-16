import { describe, expect, it } from 'vitest';
import {
  POI_CATEGORIES,
  POI_CATEGORY_INFO,
  parsePoiCategories,
  poiCategoryFromGeoapify,
  poiCategoryFromTags,
} from './categories';
import { STEP_TYPES } from '../step/types';

describe('catégories de lieux', () => {
  it('chaque catégorie a un libellé, un type d’étape, des tags OSM et des catégories Geoapify', () => {
    for (const category of POI_CATEGORIES) {
      const info = POI_CATEGORY_INFO[category];
      expect(info.label, category).toBeTruthy();
      expect(STEP_TYPES, category).toContain(info.stepType);
      expect(info.osm.length, category).toBeGreaterThan(0);
      expect(info.geoapify.length, category).toBeGreaterThan(0);
    }
  });

  it('donne le type d’étape de chaque catégorie', () => {
    expect(POI_CATEGORY_INFO.restaurant.stepType).toBe('restaurant');
    expect(POI_CATEGORY_INFO.cafe.stepType).toBe('cafe');
    expect(POI_CATEGORY_INFO.museum.stepType).toBe('museum');
    expect(POI_CATEGORY_INFO.attraction.stepType).toBe('attraction');
    expect(POI_CATEGORY_INFO.monument.stepType).toBe('monument');
    expect(POI_CATEGORY_INFO.viewpoint.stepType).toBe('viewpoint');
    expect(POI_CATEGORY_INFO.park.stepType).toBe('park');
    expect(POI_CATEGORY_INFO.beach.stepType).toBe('beach');
    expect(POI_CATEGORY_INFO.shopping.stepType).toBe('shopping');
  });
});

describe('poiCategoryFromTags', () => {
  it.each([
    [{ amenity: 'restaurant' }, 'restaurant'],
    [{ amenity: 'fast_food' }, 'restaurant'],
    [{ amenity: 'cafe' }, 'cafe'],
    [{ tourism: 'museum' }, 'museum'],
    [{ tourism: 'gallery' }, 'museum'],
    [{ tourism: 'zoo' }, 'attraction'],
    [{ historic: 'castle' }, 'monument'],
    [{ historic: 'archaeological_site' }, 'monument'],
    [{ tourism: 'artwork' }, 'monument'],
    [{ tourism: 'viewpoint' }, 'viewpoint'],
    [{ leisure: 'garden' }, 'park'],
    [{ natural: 'beach' }, 'beach'],
    [{ amenity: 'marketplace' }, 'shopping'],
    [{ shop: 'mall' }, 'shopping'],
  ] as const)('%o → %s', (tags, expected) => {
    expect(poiCategoryFromTags(tags)).toBe(expected);
  });

  it('renvoie null pour des tags inconnus ou absents', () => {
    expect(poiCategoryFromTags({ amenity: 'bench' })).toBeNull();
    expect(poiCategoryFromTags({ shop: 'bakery' })).toBeNull();
    expect(poiCategoryFromTags({})).toBeNull();
  });

  it('avec plusieurs tags, retient la première catégorie demandée qui correspond', () => {
    const tags = { tourism: 'museum', historic: 'castle' };
    expect(poiCategoryFromTags(tags)).toBe('museum');
    expect(poiCategoryFromTags(tags, ['monument'])).toBe('monument');
    expect(poiCategoryFromTags(tags, ['restaurant'])).toBeNull();
  });
});

describe('poiCategoryFromGeoapify', () => {
  it('retient la catégorie dont le préfixe Geoapify est le plus précis', () => {
    expect(poiCategoryFromGeoapify(['tourism', 'tourism.attraction'])).toBe('attraction');
    expect(poiCategoryFromGeoapify(['tourism.attraction', 'tourism.attraction.viewpoint'])).toBe(
      'viewpoint',
    );
    expect(
      poiCategoryFromGeoapify(['catering', 'catering.restaurant', 'catering.restaurant.pizza']),
    ).toBe('restaurant');
    expect(poiCategoryFromGeoapify(['heritage', 'building'])).toBe('monument');
  });

  it('se limite aux catégories demandées, null sinon', () => {
    expect(poiCategoryFromGeoapify(['catering.cafe'], ['museum'])).toBeNull();
    expect(poiCategoryFromGeoapify(['building'])).toBeNull();
  });
});

describe('parsePoiCategories', () => {
  it('lit une liste séparée par des virgules, sans doublon, dans l’ordre des catégories', () => {
    expect(parsePoiCategories('restaurant,museum,museum')).toEqual(['restaurant', 'museum']);
    expect(parsePoiCategories('museum,restaurant')).toEqual(['restaurant', 'museum']);
  });

  it('refuse une liste vide ou une catégorie inconnue', () => {
    expect(parsePoiCategories('')).toBeNull();
    expect(parsePoiCategories(undefined)).toBeNull();
    expect(parsePoiCategories('museum,casino')).toBeNull();
  });
});
