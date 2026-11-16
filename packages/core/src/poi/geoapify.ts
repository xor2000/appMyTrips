import { POI_CATEGORY_INFO, poiCategoryFromGeoapify, type PoiCategory } from './categories';
import { detailsFromTags } from './overpass';
import type { Bbox } from './tiles';
import { textOrNull, type Poi } from './types';

/** Paramètres de l'API Places de Geoapify (sans la clé). */
export function geoapifyParams(bbox: Bbox, categories: readonly PoiCategory[]) {
  return {
    categories: [...new Set(categories.flatMap((c) => POI_CATEGORY_INFO[c].geoapify))].join(','),
    filter: `rect:${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    limit: '500',
    lang: 'fr',
  };
}

interface GeoapifyProperties {
  name?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
  categories?: string[];
  address_line2?: string;
  opening_hours?: string;
  website?: string;
  contact?: { phone?: string; website?: string };
  catering?: { cuisine?: string };
  wiki_and_media?: { wikidata?: string; wikipedia?: string };
  datasource?: { raw?: Record<string, unknown> };
}

/** Normalise une réponse Geoapify ; les tags OSM bruts (`datasource.raw`) priment s'ils existent. */
export function poisFromGeoapify(json: unknown, categories: readonly PoiCategory[]): Poi[] {
  const features = (json as { features?: { properties?: GeoapifyProperties }[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const pois: Poi[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const name = textOrNull(p.name);
    if (!name || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const category = poiCategoryFromGeoapify(p.categories ?? [], categories);
    if (!category) continue;
    const raw = p.datasource?.raw ?? {};
    const osmType = typeof raw.osm_type === 'string' ? raw.osm_type.toUpperCase() : null;
    const osmRef =
      osmType && ['N', 'W', 'R'].includes(osmType) && raw.osm_id !== undefined
        ? `${osmType}${String(raw.osm_id)}`
        : null;
    const fromRaw = detailsFromTags(raw);
    const fromProps = detailsFromTags({
      opening_hours: p.opening_hours,
      website: p.website ?? p.contact?.website,
      phone: p.contact?.phone,
      cuisine: p.catering?.cuisine,
      wikidata: p.wiki_and_media?.wikidata,
      wikipedia: p.wiki_and_media?.wikipedia,
    });
    pois.push({
      id: osmRef ? `osm:${osmRef}` : `geoapify:${p.place_id ?? `${p.lat},${p.lon}`}`,
      osmRef,
      name,
      category,
      stepType: POI_CATEGORY_INFO[category].stepType,
      lat: p.lat,
      lng: p.lon,
      address: textOrNull(p.address_line2),
      openingHours: fromRaw.openingHours ?? fromProps.openingHours,
      website: fromRaw.website ?? fromProps.website,
      phone: fromRaw.phone ?? fromProps.phone,
      cuisine: fromRaw.cuisine ?? fromProps.cuisine,
      wikidata: fromRaw.wikidata ?? fromProps.wikidata,
      wikipedia: fromRaw.wikipedia ?? fromProps.wikipedia,
      source: 'geoapify',
    });
  }
  return pois;
}
