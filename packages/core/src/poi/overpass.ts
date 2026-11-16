import { POI_CATEGORY_INFO, poiCategoryFromTags, type PoiCategory } from './categories';
import type { Bbox } from './tiles';
import { httpUrlOrNull, textOrNull, type Poi } from './types';

/** Requête Overpass QL : lieux nommés des catégories, dans la zone ; centre pour les ways. */
export function overpassQuery(bbox: Bbox, categories: readonly PoiCategory[]): string {
  const area = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  const statements = categories.flatMap((category) =>
    POI_CATEGORY_INFO[category].osm.map(
      (rule) => `nwr["${rule.key}"~"^(${rule.values.join('|')})$"]["name"]${area};`,
    ),
  );
  return `[out:json][timeout:20];\n(\n${statements.join('\n')}\n);\nout center tags;`;
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

const OSM_TYPE: Record<string, string> = { node: 'N', way: 'W', relation: 'R' };

/** Adresse lisible depuis les tags `addr:*`. */
export function addressFromTags(tags: Record<string, string | undefined>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const town = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [street, town].filter(Boolean).join(', ') || null;
}

/** Champs d'un lieu tirés des tags OSM (communs à Overpass et aux tags bruts de Geoapify). */
export function detailsFromTags(tags: Record<string, unknown>) {
  return {
    openingHours: textOrNull(tags.opening_hours),
    website: httpUrlOrNull(tags.website) ?? httpUrlOrNull(tags['contact:website']),
    phone: textOrNull(tags.phone) ?? textOrNull(tags['contact:phone']),
    cuisine: textOrNull(tags.cuisine),
    wikidata: textOrNull(tags.wikidata),
    wikipedia: textOrNull(tags.wikipedia),
  };
}

/** Normalise une réponse Overpass ; ignore les lieux sans nom, sans point ou hors catégories. */
export function poisFromOverpass(json: unknown, categories: readonly PoiCategory[]): Poi[] {
  const elements = (json as { elements?: OverpassElement[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  const pois: Poi[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = textOrNull(tags.name);
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const type = OSM_TYPE[el.type ?? ''];
    if (
      !name ||
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !type ||
      el.id === undefined
    ) {
      continue;
    }
    const category = poiCategoryFromTags(tags, categories);
    if (!category) continue;
    const osmRef = `${type}${el.id}`;
    pois.push({
      id: `osm:${osmRef}`,
      osmRef,
      name,
      category,
      stepType: POI_CATEGORY_INFO[category].stepType,
      lat,
      lng,
      address: addressFromTags(tags),
      ...detailsFromTags(tags),
      source: 'overpass',
    });
  }
  return pois;
}
