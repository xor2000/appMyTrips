import {
  POI_MAX_TILES,
  POI_MIN_ZOOM,
  POI_TILE_ZOOM,
  bboxCenter,
  httpUrlOrNull,
  parseBbox,
  parsePoiCategories,
  parseWikiRef,
  pointInBbox,
  rankPois,
  tileBbox,
  tileOf,
  tilesForBbox,
  unionBbox,
  type Poi,
  type PoiCategory,
  type Tile,
  type WikiSummary,
} from '@mytrips/core';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth';
import { getCachedPois, putCachedPois } from '../db/poiCache';
import {
  PoiUnavailableError,
  USER_AGENT,
  poiProviders,
  searchWithFallback,
} from '../poi/providers';

const cacheKey = (category: PoiCategory, t: Tile) => `${category}:${POI_TILE_ZOOM}:${t.x}:${t.y}`;

/** Résumé Wikipédia (API REST) ; null si l'article n'existe pas. */
async function wikiSummary(
  fetchImpl: typeof fetch,
  lang: string,
  title: string,
): Promise<WikiSummary | null> {
  const path = encodeURIComponent(title.replace(/ /g, '_'));
  const res = await fetchImpl(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${path}`, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipédia ${res.status}`);
  const body = (await res.json()) as {
    title?: string;
    extract?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };
  if (!body.title || !body.extract) return null;
  return {
    title: body.title,
    extract: body.extract,
    thumbnail: httpUrlOrNull(body.thumbnail?.source),
    url:
      httpUrlOrNull(body.content_urls?.desktop?.page) ??
      `https://${lang}.wikipedia.org/wiki/${path}`,
  };
}

/** Titre de l'article lié à une entité Wikidata, en français sinon en anglais. */
async function wikidataSitelink(
  fetchImpl: typeof fetch,
  id: string,
): Promise<{ lang: string; title: string } | null> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: id,
    props: 'sitelinks',
    sitefilter: 'frwiki|enwiki',
    format: 'json',
  }).toString();
  const res = await fetchImpl(url.toString(), {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const body = (await res.json()) as {
    entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
  };
  const links = body.entities?.[id]?.sitelinks ?? {};
  for (const lang of ['fr', 'en']) {
    const title = links[`${lang}wiki`]?.title;
    if (title) return { lang, title };
  }
  return null;
}

/** Découverte de lieux (zone visible, par catégorie) et résumés Wikipédia. */
export function poiRoutes(fetchImpl: typeof fetch) {
  const routes = new Hono<AuthEnv>();

  routes.get('/', async (c) => {
    const bbox = parseBbox(c.req.query('bbox'));
    if (!bbox) return c.json({ error: 'invalid_bbox' }, 400);
    const zoomParam = c.req.query('zoom');
    const zoom = zoomParam ? Number(zoomParam) : NaN;
    if (!Number.isFinite(zoom)) return c.json({ error: 'invalid_zoom' }, 400);
    const categories = parsePoiCategories(c.req.query('categories'));
    if (!categories) return c.json({ error: 'invalid_categories' }, 400);
    if (zoom < POI_MIN_ZOOM) return c.json({ error: 'zoom_too_low' }, 400);
    const tiles = tilesForBbox(bbox, POI_TILE_ZOOM);
    if (tiles.length > POI_MAX_TILES) return c.json({ error: 'area_too_large' }, 400);

    const wanted = categories.flatMap((category) =>
      tiles.map((tile) => ({ category, tile, key: cacheKey(category, tile) })),
    );
    const cached = await getCachedPois(
      c.env.DB,
      wanted.map((w) => w.key),
    );
    const missing = wanted.filter((w) => !cached.has(w.key));
    const found: Poi[] = [...cached.values()].flat();
    let source: 'cache' | Poi['source'] = 'cache';

    if (missing.length > 0) {
      // Une seule requête : catégories manquantes, sur la zone qui couvre les cases manquantes.
      const missingCategories = categories.filter((cat) => missing.some((m) => m.category === cat));
      const area = unionBbox(missing.map((m) => tileBbox(m.tile.x, m.tile.y, POI_TILE_ZOOM)));
      let result: Awaited<ReturnType<typeof searchWithFallback>>;
      try {
        result = await searchWithFallback(poiProviders(c.env, fetchImpl), area, missingCategories);
      } catch (e) {
        if (e instanceof PoiUnavailableError) {
          console.error(e.message);
          return c.json({ error: 'poi_unavailable' }, 503);
        }
        throw e;
      }
      source = result.source;
      // Répartition par case ; une case manquante sans lieu est mise en cache vide.
      const byKey = new Map<string, Poi[]>(missing.map((m) => [m.key, []]));
      for (const poi of result.pois) {
        const bucket = byKey.get(cacheKey(poi.category, tileOf(poi.lat, poi.lng, POI_TILE_ZOOM)));
        if (bucket) bucket.push(poi);
      }
      await putCachedPois(
        c.env.DB,
        [...byKey].map(([key, pois]) => ({ key, pois })),
        result.source,
      );
      found.push(...[...byKey.values()].flat());
    }

    const visible = found.filter((p) => pointInBbox(p, bbox));
    return c.json({ pois: rankPois(visible, bboxCenter(bbox)), source });
  });

  routes.get('/wiki', async (c) => {
    const ref = parseWikiRef(c.req.query('ref'));
    if (!ref) return c.json({ error: 'invalid_ref' }, 400);
    try {
      const article = 'wikidata' in ref ? await wikidataSitelink(fetchImpl, ref.wikidata) : ref;
      const summary = article ? await wikiSummary(fetchImpl, article.lang, article.title) : null;
      return c.json({ summary });
    } catch {
      return c.json({ error: 'wiki_unavailable' }, 502);
    }
  });

  return routes;
}
