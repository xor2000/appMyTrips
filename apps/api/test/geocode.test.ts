import { describe, expect, it, vi } from 'vitest';
import { ALICE, makeCaller } from './helpers';

const LOUVRE_FEATURE = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [2.3376, 48.8606] },
  properties: {
    osm_type: 'W',
    osm_id: 1234,
    osm_key: 'tourism',
    osm_value: 'museum',
    name: 'Musée du Louvre',
    housenumber: '99',
    street: 'Rue de Rivoli',
    postcode: '75001',
    city: 'Paris',
    country: 'France',
  },
};

function photon(features: unknown[], status = 200) {
  return vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ type: 'FeatureCollection', features }), { status }),
    );
}

describe('GET /api/geocode', () => {
  it('relaie la recherche à Photon et normalise les résultats', async () => {
    const fetcher = photon([LOUVRE_FEATURE]);
    const call = makeCaller(fetcher);
    const res = await call(ALICE, 'GET', '/api/geocode?q=Louvre&lat=48.85&lng=2.35');
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      {
        name: 'Musée du Louvre',
        address: '99 Rue de Rivoli, 75001 Paris, France',
        lat: 48.8606,
        lng: 2.3376,
        type: 'museum',
        osmRef: 'W1234',
      },
    ]);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://photon.komoot.io/api/');
    expect(u.searchParams.get('q')).toBe('Louvre');
    expect(u.searchParams.get('lang')).toBe('fr');
    expect(u.searchParams.get('lat')).toBe('48.85');
    expect(u.searchParams.get('lon')).toBe('2.35');
    expect(new Headers(init.headers).get('user-agent')).toMatch(/MyTrips/);
  });

  it('PHOTON_URL avec un chemin (relais) : le chemin est conservé', async () => {
    const fetcher = photon([]);
    await makeCaller(fetcher, { PHOTON_URL: 'http://relais.test/photon/' })(
      ALICE,
      'GET',
      '/api/geocode?q=Louvre',
    );
    const u = new URL((fetcher.mock.calls[0] as [string])[0]);
    expect(u.origin + u.pathname).toBe('http://relais.test/photon/api/');
  });

  it('refuse une recherche vide (400) sans appeler Photon', async () => {
    const fetcher = photon([]);
    const res = await makeCaller(fetcher)(ALICE, 'GET', '/api/geocode?q=%20');
    expect(res.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('répond 502 si Photon est indisponible', async () => {
    const res = await makeCaller(photon([], 503))(ALICE, 'GET', '/api/geocode?q=Louvre');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('geocoder_unavailable');
  });

  it('répond 502 si Photon ne répond pas (erreur réseau)', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('réseau'));
    const res = await makeCaller(fetcher)(ALICE, 'GET', '/api/geocode?q=Louvre');
    expect(res.status).toBe(502);
  });

  it('exige une identité (401)', async () => {
    const res = await makeCaller(photon([]))('', 'GET', '/api/geocode?q=Louvre');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/geocode/reverse', () => {
  it('renvoie le lieu le plus proche du point', async () => {
    const fetcher = photon([LOUVRE_FEATURE]);
    const res = await makeCaller(fetcher)(ALICE, 'GET', '/api/geocode/reverse?lat=48.86&lng=2.337');
    expect(res.body.result).toMatchObject({ name: 'Musée du Louvre', lat: 48.8606 });
    const u = new URL((fetcher.mock.calls[0] as [string])[0]);
    expect(u.pathname).toBe('/reverse');
  });

  it('renvoie null quand rien n’est trouvé', async () => {
    const res = await makeCaller(photon([]))(ALICE, 'GET', '/api/geocode/reverse?lat=0&lng=0');
    expect(res.body.result).toBeNull();
  });

  it('refuse des coordonnées invalides (400)', async () => {
    const res = await makeCaller(photon([]))(ALICE, 'GET', '/api/geocode/reverse?lat=95&lng=0');
    expect(res.status).toBe(400);
  });
});
