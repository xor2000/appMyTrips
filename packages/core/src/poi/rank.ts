import type { Poi } from './types';

/** Nombre maximal de lieux renvoyés par catégorie. */
export const POI_LIMIT_PER_CATEGORY = 200;

/** Distance approchée (équirectangulaire), suffisante pour classer à l'échelle d'une ville. */
function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const x = (b.lng - a.lng) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const y = b.lat - a.lat;
  return x * x + y * y;
}

const hasWiki = (p: Poi) => p.wikidata !== null || p.wikipedia !== null;

/**
 * Classement : lieux avec article Wikipédia d'abord, puis par distance au centre de la vue.
 * Doublons retirés, `limit` lieux au plus par catégorie.
 */
export function rankPois(
  pois: readonly Poi[],
  center: { lat: number; lng: number },
  limit = POI_LIMIT_PER_CATEGORY,
): Poi[] {
  const unique = [...new Map(pois.map((p) => [p.id, p])).values()];
  const sorted = unique
    .map((p) => ({ p, wiki: hasWiki(p) ? 0 : 1, d: distance(center, p) }))
    .sort((a, b) => a.wiki - b.wiki || a.d - b.d)
    .map(({ p }) => p);
  const counts = new Map<string, number>();
  return sorted.filter((p) => {
    const n = counts.get(p.category) ?? 0;
    counts.set(p.category, n + 1);
    return n < limit;
  });
}

/** Référence Wikipédia d'un lieu : Wikidata d'abord (permet le résumé en français). */
export function wikiRef(poi: Pick<Poi, 'wikidata' | 'wikipedia'>): string | null {
  // Un tag OSM peut porter plusieurs valeurs séparées par « ; » : la première suffit.
  const first = (v: string | null) => v?.split(';')[0]?.trim() || null;
  return first(poi.wikidata) ?? first(poi.wikipedia);
}

export type WikiRef = { wikidata: string } | { lang: string; title: string };

/**
 * Lit « Q123 » ou « langue:titre ». La langue devient un sous-domaine de wikipedia.org :
 * elle est strictement contrôlée.
 */
export function parseWikiRef(ref: string | undefined): WikiRef | null {
  if (!ref) return null;
  if (/^Q\d+$/.test(ref)) return { wikidata: ref };
  const m = /^([a-z]{2,3}(?:-[a-z]{2,8})?):(.+)$/.exec(ref);
  if (!m || !m[2]!.trim()) return null;
  return { lang: m[1]!, title: m[2]!.trim() };
}
