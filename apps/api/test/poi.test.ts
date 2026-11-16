import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { ALICE, BOB, call, createTrip, makeCaller, addMember } from './helpers';

/**
 * Le stockage D1 n'est pas isolé entre les tests : chaque test explore sa propre zone (`area(n)`),
 * pour ne jamais tomber sur le cache d'un autre test.
 */
let areaIndex = 0;
function area() {
  const west = -60 + areaIndex++ * 0.5;
  return {
    west,
    south: 10,
    east: west + 0.01,
    north: 10.01,
    center: { lat: 10.005, lng: west + 0.005 },
  };
}
const bboxParam = (a: ReturnType<typeof area>) => `${a.west},${a.south},${a.east},${a.north}`;

function overpassBody(elements: unknown[]) {
  return JSON.stringify({ elements });
}

function museum(id: number, lat: number, lon: number, tags: Record<string, string> = {}) {
  return { type: 'node', id, lat, lon, tags: { name: `Musée ${id}`, tourism: 'museum', ...tags } };
}

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

/** fetch simulé : chaque appel est routé selon son URL. */
function fakeFetch(route: Route) {
  return vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) =>
    route(String(input), init),
  ) as unknown as typeof fetch & { mock: { calls: [string, RequestInit][] } };
}

/**
 * Appelant aux bindings de fournisseurs fixés : un test ne doit jamais dépendre de `.dev.vars`.
 */
const poiCaller = (fetcher: typeof fetch, bindings: Record<string, string | undefined> = {}) =>
  makeCaller(fetcher, {
    OVERPASS_URLS: undefined,
    GEOAPIFY_API_KEY: undefined,
    GEOAPIFY_URL: undefined,
    ...bindings,
  });

const json = (body: string, status = 200) => new Response(body, { status });
const OVERPASS_1 = 'https://overpass-api.de/api/interpreter';

describe('GET /api/poi', () => {
  it('interroge Overpass et renvoie les lieux de la zone, classés', async () => {
    const a = area();
    const fetcher = fakeFetch(() =>
      json(
        overpassBody([
          museum(1, a.center.lat + 0.004, a.center.lng + 0.004),
          museum(2, a.center.lat, a.center.lng),
          museum(3, a.center.lat + 0.003, a.center.lng, { wikidata: 'Q1' }),
          // Hors de la zone visible (mais dans la case) : écarté.
          museum(4, a.north + 0.002, a.center.lng),
        ]),
      ),
    );
    const res = await poiCaller(fetcher)(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(res.status).toBe(200);
    expect(res.body.pois.map((p: { name: string }) => p.name)).toEqual([
      'Musée 3',
      'Musée 2',
      'Musée 1',
    ]);
    expect(res.body.pois[0]).toMatchObject({
      category: 'museum',
      stepType: 'museum',
      osmRef: 'N3',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(OVERPASS_1);
    expect(init.method).toBe('POST');
    expect(decodeURIComponent(String(init.body))).toContain('"tourism"~"^(museum|gallery)$"');
    expect(new Headers(init.headers).get('user-agent')).toMatch(/MyTrips/);
  });

  it('passe à l’instance Overpass de repli sur 429', async () => {
    const a = area();
    const fetcher = fakeFetch((url) =>
      url === OVERPASS_1
        ? json('trop de requêtes', 429)
        : json(overpassBody([museum(10, a.center.lat, a.center.lng)])),
    );
    const res = await poiCaller(fetcher)(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(res.status).toBe(200);
    expect(res.body.pois).toHaveLength(1);
    expect(fetcher.mock.calls).toHaveLength(2);
    expect(fetcher.mock.calls[1]![0]).not.toBe(OVERPASS_1);
  });

  it('une réponse Overpass incomplète (remark « runtime error ») passe à l’instance suivante, sans cache', async () => {
    const a = area();
    const partial = JSON.stringify({
      remark: 'runtime error: Query timed out in "query" at line 3 after 21 seconds.',
      elements: [museum(11, a.center.lat, a.center.lng)],
    });
    const fetcher = fakeFetch((url) =>
      url === OVERPASS_1
        ? json(partial)
        : json(
            overpassBody([
              museum(12, a.center.lat, a.center.lng),
              museum(13, a.center.lat, a.center.lng + 0.001),
            ]),
          ),
    );
    const res = await poiCaller(fetcher)(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(res.body.pois.map((p: { osmRef: string }) => p.osmRef).sort()).toEqual(['N12', 'N13']);
  });

  it('les instances Overpass sont configurables (OVERPASS_URLS)', async () => {
    const a = area();
    const fetcher = fakeFetch(() => json(overpassBody([])));
    await poiCaller(fetcher, { OVERPASS_URLS: 'http://overpass.test/api/interpreter' })(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(fetcher.mock.calls[0]![0]).toBe('http://overpass.test/api/interpreter');
  });

  it('bascule sur Geoapify quand toutes les instances Overpass échouent (5xx, délai dépassé)', async () => {
    const a = area();
    const fetcher = fakeFetch((url) => {
      if (url === OVERPASS_1) return json('panne', 504);
      if (url.includes('geoapify')) {
        return json(
          JSON.stringify({
            features: [
              {
                properties: {
                  name: 'Musée Geoapify',
                  lat: a.center.lat,
                  lon: a.center.lng,
                  place_id: 'g1',
                  categories: ['entertainment.museum'],
                },
              },
            ],
          }),
        );
      }
      throw new DOMException('délai dépassé', 'TimeoutError');
    });
    const res = await poiCaller(fetcher, { GEOAPIFY_API_KEY: 'cle-de-test' })(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(res.status).toBe(200);
    expect(res.body.pois).toMatchObject([{ name: 'Musée Geoapify', source: 'geoapify' }]);
    const geo = new URL(fetcher.mock.calls[2]![0]);
    expect(geo.origin + geo.pathname).toBe('https://api.geoapify.com/v2/places');
    expect(geo.searchParams.get('apiKey')).toBe('cle-de-test');
    expect(geo.searchParams.get('categories')).toContain('entertainment.museum');
  });

  it('GEOAPIFY_URL avec un chemin (relais) : le chemin est conservé', async () => {
    const a = area();
    const fetcher = fakeFetch((url) =>
      url.includes('relais.test') ? json(JSON.stringify({ features: [] })) : json('panne', 500),
    );
    await poiCaller(fetcher, {
      GEOAPIFY_API_KEY: 'cle',
      GEOAPIFY_URL: 'http://relais.test/geoapify',
    })(ALICE, 'GET', `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`);
    const geo = new URL(fetcher.mock.calls[2]![0]);
    expect(geo.origin + geo.pathname).toBe('http://relais.test/geoapify/v2/places');
  });

  it('répond 503 avec un message clair quand tous les fournisseurs échouent', async () => {
    const a = area();
    const fetcher = fakeFetch(() => json('panne', 500));
    const res = await poiCaller(fetcher, { GEOAPIFY_API_KEY: 'cle-de-test' })(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('poi_unavailable');
    expect(fetcher.mock.calls).toHaveLength(3);
  });

  it('sans clé Geoapify, s’arrête après Overpass (503)', async () => {
    const a = area();
    const fetcher = fakeFetch(() => json('panne', 500));
    const res = await poiCaller(fetcher, { GEOAPIFY_API_KEY: undefined })(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(res.status).toBe(503);
    expect(fetcher.mock.calls).toHaveLength(2);
  });

  it('sert la même zone depuis le cache, sans rappeler le fournisseur', async () => {
    const a = area();
    const fetcher = fakeFetch(() => json(overpassBody([museum(20, a.center.lat, a.center.lng)])));
    const caller = poiCaller(fetcher);
    const path = `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`;
    const first = await caller(ALICE, 'GET', path);
    const second = await caller(ALICE, 'GET', path);
    expect(second.status).toBe(200);
    expect(second.body.pois).toEqual(first.body.pois);
    expect(fetcher.mock.calls).toHaveLength(1);
  });

  it('ne demande que les catégories absentes du cache', async () => {
    const a = area();
    const fetcher = fakeFetch(() => json(overpassBody([])));
    const caller = poiCaller(fetcher);
    await caller(ALICE, 'GET', `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`);
    await caller(ALICE, 'GET', `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum,cafe`);
    expect(fetcher.mock.calls).toHaveLength(2);
    const query = decodeURIComponent(String(fetcher.mock.calls[1]![1].body));
    expect(query).toContain('"amenity"~"^(cafe)$"');
    expect(query).not.toContain('museum');
  });

  it('redemande une case dont le cache a plus de 7 jours', async () => {
    const a = area();
    const old = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    const fetcher = fakeFetch(() => json(overpassBody([museum(30, a.center.lat, a.center.lng)])));
    const caller = poiCaller(fetcher);
    const path = `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`;
    await caller(ALICE, 'GET', path);
    await env.DB.prepare('UPDATE poi_cache SET created_at = ?, payload = ? WHERE key LIKE ?')
      .bind(old, '[]', 'museum:%')
      .run();
    const res = await caller(ALICE, 'GET', path);
    expect(fetcher.mock.calls).toHaveLength(2);
    expect(res.body.pois).toHaveLength(1);
  });

  it('refuse un zoom inférieur à 12 (400) sans appeler de fournisseur', async () => {
    const a = area();
    const fetcher = fakeFetch(() => json(overpassBody([])));
    const res = await poiCaller(fetcher)(
      ALICE,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=11.5&categories=museum`,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('zoom_too_low');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuse une zone trop grande (400 area_too_large)', async () => {
    const fetcher = fakeFetch(() => json(overpassBody([])));
    const res = await poiCaller(fetcher)(
      ALICE,
      'GET',
      '/api/poi?bbox=2,48,3,49&zoom=12&categories=museum',
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('area_too_large');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['zone invalide', 'bbox=3,48,2,49&zoom=13&categories=museum', 'invalid_bbox'],
    ['zoom absent', 'bbox=2,48,2.01,48.01&categories=museum', 'invalid_zoom'],
    ['catégorie inconnue', 'bbox=2,48,2.01,48.01&zoom=13&categories=casino', 'invalid_categories'],
  ])('refuse une requête mal formée : %s', async (_, query, code) => {
    const res = await call(ALICE, 'GET', `/api/poi?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(code);
  });

  it('exige une identité (401)', async () => {
    const res = await call('', 'GET', '/api/poi?bbox=2,48,2.01,48.01&zoom=13&categories=museum');
    expect(res.status).toBe(401);
  });

  it('un lecteur (viewer) peut explorer, mais pas ajouter le lieu au voyage', async () => {
    const a = area();
    const t = await createTrip();
    await addMember(t.trip.id, BOB, 'viewer');
    const fetcher = fakeFetch(() => json(overpassBody([museum(40, a.center.lat, a.center.lng)])));
    const explore = await poiCaller(fetcher)(
      BOB,
      'GET',
      `/api/poi?bbox=${bboxParam(a)}&zoom=15&categories=museum`,
    );
    expect(explore.status).toBe(200);
    const poi = explore.body.pois[0];
    const add = await call(
      BOB,
      'POST',
      `/api/trips/${t.trip.id}/steps`,
      {
        dayId: null,
        type: poi.stepType,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        osmRef: poi.osmRef,
      },
      { 'if-match': String(t.trip.version) },
    );
    expect(add.status).toBe(403);
  });
});

describe('GET /api/poi/wiki', () => {
  const SUMMARY = {
    title: 'Musée du Louvre',
    extract: 'Le musée du Louvre est un musée d’art et d’antiquités.',
    thumbnail: { source: 'https://upload.wikimedia.org/louvre.jpg' },
    content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Mus%C3%A9e_du_Louvre' } },
  };

  it('renvoie le résumé d’un article « langue:titre »', async () => {
    const fetcher = fakeFetch(() => json(JSON.stringify(SUMMARY)));
    const res = await poiCaller(fetcher)(
      ALICE,
      'GET',
      `/api/poi/wiki?ref=${encodeURIComponent('fr:Musée du Louvre')}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      title: 'Musée du Louvre',
      extract: SUMMARY.extract,
      thumbnail: 'https://upload.wikimedia.org/louvre.jpg',
      url: 'https://fr.wikipedia.org/wiki/Mus%C3%A9e_du_Louvre',
    });
    expect(fetcher.mock.calls[0]![0]).toBe(
      'https://fr.wikipedia.org/api/rest_v1/page/summary/Mus%C3%A9e_du_Louvre',
    );
  });

  it('avec un identifiant Wikidata, prend l’article français, sinon anglais', async () => {
    const fetcher = fakeFetch((url) =>
      url.includes('wikidata.org')
        ? json(
            JSON.stringify({
              entities: { Q42: { sitelinks: { enwiki: { site: 'enwiki', title: 'Some Place' } } } },
            }),
          )
        : json(JSON.stringify({ ...SUMMARY, title: 'Some Place' })),
    );
    const res = await poiCaller(fetcher)(ALICE, 'GET', '/api/poi/wiki?ref=Q42');
    expect(res.body.summary.title).toBe('Some Place');
    const wikidata = new URL(fetcher.mock.calls[0]![0]);
    expect(wikidata.searchParams.get('ids')).toBe('Q42');
    expect(fetcher.mock.calls[1]![0]).toBe(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Some_Place',
    );
  });

  it('renvoie null quand l’article n’existe pas', async () => {
    const fetcher = fakeFetch(() => json('{}', 404));
    const res = await poiCaller(fetcher)(ALICE, 'GET', '/api/poi/wiki?ref=fr:Inconnu');
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeNull();
  });

  it('refuse une référence invalide (400) sans appeler Wikipédia', async () => {
    const fetcher = fakeFetch(() => json('{}'));
    const res = await poiCaller(fetcher)(
      ALICE,
      'GET',
      `/api/poi/wiki?ref=${encodeURIComponent('evil.example.com/x:Titre')}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_ref');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('répond 502 si Wikipédia est indisponible', async () => {
    const fetcher = fakeFetch(() => json('panne', 503));
    const res = await poiCaller(fetcher)(ALICE, 'GET', '/api/poi/wiki?ref=fr:Louvre');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('wiki_unavailable');
  });
});
