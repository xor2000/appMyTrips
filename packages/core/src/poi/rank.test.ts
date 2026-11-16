import { describe, expect, it } from 'vitest';
import { parseWikiRef, rankPois, wikiRef } from './rank';
import type { Poi } from './types';

function poi(id: string, lat: number, lng: number, extra: Partial<Poi> = {}): Poi {
  return {
    id,
    osmRef: null,
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
    ...extra,
  };
}

const CENTER = { lat: 48.86, lng: 2.34 };

describe('rankPois', () => {
  it('place d’abord les lieux avec un article Wikipédia, puis par distance au centre', () => {
    const near = poi('proche', 48.8601, 2.3401);
    const far = poi('loin', 48.87, 2.36);
    const wiki = poi('wiki loin', 48.875, 2.37, { wikidata: 'Q1' });
    const ranked = rankPois([far, near, wiki], CENTER);
    expect(ranked.map((p) => p.id)).toEqual(['wiki loin', 'proche', 'loin']);
  });

  it('plafonne le nombre de lieux par catégorie', () => {
    const many = Array.from({ length: 5 }, (_, i) => poi(`m${i}`, 48.86 + i / 1000, 2.34));
    const cafes = Array.from({ length: 3 }, (_, i) =>
      poi(`c${i}`, 48.86, 2.34 + i / 1000, { category: 'cafe', stepType: 'cafe' }),
    );
    const ranked = rankPois([...many, ...cafes], CENTER, 2);
    expect(ranked.map((p) => p.id).sort()).toEqual(['c0', 'c1', 'm0', 'm1']);
  });

  it('retire les doublons (même identifiant)', () => {
    const a = poi('a', 48.86, 2.34);
    expect(rankPois([a, { ...a }], CENTER)).toHaveLength(1);
  });
});

describe('références Wikipédia', () => {
  it('wikiRef préfère Wikidata (résumé en français possible), sinon le tag wikipedia', () => {
    expect(wikiRef(poi('a', 0, 0, { wikidata: 'Q19675', wikipedia: 'en:Louvre' }))).toBe('Q19675');
    expect(wikiRef(poi('a', 0, 0, { wikipedia: 'fr:Musée du Louvre' }))).toBe('fr:Musée du Louvre');
    expect(wikiRef(poi('a', 0, 0))).toBeNull();
    // Tag à valeurs multiples : la première.
    expect(wikiRef(poi('a', 0, 0, { wikidata: 'Q1;Q2' }))).toBe('Q1');
  });

  it('parseWikiRef lit un identifiant Wikidata ou « langue:titre »', () => {
    expect(parseWikiRef('Q19675')).toEqual({ wikidata: 'Q19675' });
    expect(parseWikiRef('fr:Musée du Louvre')).toEqual({ lang: 'fr', title: 'Musée du Louvre' });
    expect(parseWikiRef('zh-yue:標題')).toEqual({ lang: 'zh-yue', title: '標題' });
  });

  it('parseWikiRef refuse une langue qui pourrait détourner l’hôte appelé', () => {
    expect(parseWikiRef('evil.example.com/x:Titre')).toBeNull();
    expect(parseWikiRef('fr.evil:Titre')).toBeNull();
    expect(parseWikiRef('fr:')).toBeNull();
    expect(parseWikiRef('')).toBeNull();
    expect(parseWikiRef('Q12x')).toBeNull();
  });
});
