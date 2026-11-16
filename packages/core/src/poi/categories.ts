import type { StepType } from '../step/types';

/** Catégories de la découverte de lieux, dans l'ordre d'affichage des pastilles. */
export const POI_CATEGORIES = [
  'restaurant',
  'cafe',
  'museum',
  'attraction',
  'monument',
  'viewpoint',
  'park',
  'beach',
  'shopping',
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number];

/** Règle OSM : la clé `key` vaut l'une des `values`. */
export interface OsmRule {
  key: string;
  values: readonly string[];
}

export interface PoiCategoryInfo {
  label: string;
  stepType: StepType;
  osm: readonly OsmRule[];
  /** Catégories Geoapify (préfixes hiérarchiques, ex. `catering.restaurant`). */
  geoapify: readonly string[];
}

export const POI_CATEGORY_INFO: Record<PoiCategory, PoiCategoryInfo> = {
  restaurant: {
    label: 'Restaurants',
    stepType: 'restaurant',
    osm: [{ key: 'amenity', values: ['restaurant', 'fast_food'] }],
    geoapify: ['catering.restaurant', 'catering.fast_food'],
  },
  cafe: {
    label: 'Cafés',
    stepType: 'cafe',
    osm: [{ key: 'amenity', values: ['cafe'] }],
    geoapify: ['catering.cafe'],
  },
  museum: {
    label: 'Musées',
    stepType: 'museum',
    osm: [{ key: 'tourism', values: ['museum', 'gallery'] }],
    geoapify: ['entertainment.museum', 'entertainment.culture.gallery'],
  },
  attraction: {
    label: 'Attractions',
    stepType: 'attraction',
    osm: [{ key: 'tourism', values: ['attraction', 'theme_park', 'zoo', 'aquarium'] }],
    geoapify: [
      'tourism.attraction',
      'entertainment.theme_park',
      'entertainment.zoo',
      'entertainment.aquarium',
    ],
  },
  monument: {
    label: 'Monuments',
    stepType: 'monument',
    osm: [
      {
        key: 'historic',
        values: ['monument', 'memorial', 'castle', 'ruins', 'archaeological_site'],
      },
      { key: 'tourism', values: ['artwork'] },
    ],
    geoapify: ['heritage', 'tourism.sights'],
  },
  viewpoint: {
    label: 'Points de vue',
    stepType: 'viewpoint',
    osm: [{ key: 'tourism', values: ['viewpoint'] }],
    geoapify: ['tourism.attraction.viewpoint'],
  },
  park: {
    label: 'Parcs',
    stepType: 'park',
    osm: [{ key: 'leisure', values: ['park', 'garden'] }],
    geoapify: ['leisure.park'],
  },
  beach: {
    label: 'Plages',
    stepType: 'beach',
    osm: [{ key: 'natural', values: ['beach'] }],
    geoapify: ['beach'],
  },
  shopping: {
    label: 'Shopping',
    stepType: 'shopping',
    osm: [
      { key: 'shop', values: ['mall', 'marketplace'] },
      { key: 'amenity', values: ['marketplace'] },
    ],
    geoapify: ['commercial.marketplace', 'commercial.shopping_mall'],
  },
};

/** Catégorie d'un lieu OSM : la première des catégories `among` dont une règle correspond. */
export function poiCategoryFromTags(
  tags: Record<string, string | undefined>,
  among: readonly PoiCategory[] = POI_CATEGORIES,
): PoiCategory | null {
  for (const category of among) {
    const match = POI_CATEGORY_INFO[category].osm.some((rule) => {
      const value = tags[rule.key];
      return value !== undefined && rule.values.includes(value);
    });
    if (match) return category;
  }
  return null;
}

/** Catégorie d'un lieu Geoapify : celle dont le préfixe correspondant est le plus précis. */
export function poiCategoryFromGeoapify(
  categories: readonly string[],
  among: readonly PoiCategory[] = POI_CATEGORIES,
): PoiCategory | null {
  let best: { category: PoiCategory; length: number } | null = null;
  for (const category of among) {
    for (const prefix of POI_CATEGORY_INFO[category].geoapify) {
      const hit = categories.some((c) => c === prefix || c.startsWith(`${prefix}.`));
      if (hit && (!best || prefix.length > best.length)) best = { category, length: prefix.length };
    }
  }
  return best?.category ?? null;
}

/** Liste de catégories « a,b,c » : sans doublon, dans l'ordre de POI_CATEGORIES ; null si invalide. */
export function parsePoiCategories(value: string | undefined): PoiCategory[] | null {
  if (!value) return null;
  const wanted = new Set(value.split(',').map((s) => s.trim()));
  if (![...wanted].every((c) => (POI_CATEGORIES as readonly string[]).includes(c))) return null;
  return POI_CATEGORIES.filter((c) => wanted.has(c));
}
