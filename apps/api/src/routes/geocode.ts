import { stepTypeFromOsm, type Place } from '@mytrips/core';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth';

const DEFAULT_PHOTON_URL = 'https://photon.komoot.io';
/** Identification demandée par la politique d'usage de Photon (sans donnée personnelle). */
const USER_AGENT = 'MyTrips/0.1 (application personnelle de carnet de voyage)';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

function toPlace(f: PhotonFeature): Place | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const p = f.properties ?? {};
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
  const street = [str('housenumber'), str('street')].filter(Boolean).join(' ');
  const town = [str('postcode'), str('city') ?? str('town') ?? str('village')]
    .filter(Boolean)
    .join(' ');
  const address = [street, town, str('country')].filter(Boolean).join(', ') || null;
  const name = str('name') ?? (street || str('city') || address);
  if (!name) return null;
  const osmType = str('osm_type');
  const osmId = p.osm_id;
  return {
    name,
    address,
    lat,
    lng,
    type: stepTypeFromOsm(str('osm_key'), str('osm_value')),
    osmRef: osmType && osmId !== undefined ? `${osmType}${osmId}` : null,
  };
}

function parseCoord(value: string | undefined, max: number): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : NaN;
}

/** Relais du géocodage Photon : recherche de lieux et géocodage inverse. */
export function geocodeRoutes(fetchImpl: typeof fetch) {
  const routes = new Hono<AuthEnv>();

  async function photon(
    c: { env: AuthEnv['Bindings'] },
    path: string,
    params: Record<string, string>,
  ) {
    const url = new URL(path, c.env.PHOTON_URL ?? DEFAULT_PHOTON_URL);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetchImpl(url.toString(), {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    return (body.features ?? []).map(toPlace).filter((p): p is Place => p !== null);
  }

  routes.get('/', async (c) => {
    const q = (c.req.query('q') ?? '').trim();
    if (!q || q.length > 200) return c.json({ error: 'invalid_query' }, 400);
    const lat = parseCoord(c.req.query('lat'), 90);
    const lng = parseCoord(c.req.query('lng'), 180);
    const params: Record<string, string> = { q, lang: 'fr', limit: '8' };
    // Biais vers la zone visible de la carte, si elle est fournie.
    if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      params.lat = String(lat);
      params.lon = String(lng);
    }
    try {
      return c.json({ results: await photon(c, '/api/', params) });
    } catch {
      return c.json({ error: 'geocoder_unavailable' }, 502);
    }
  });

  routes.get('/reverse', async (c) => {
    const lat = parseCoord(c.req.query('lat'), 90);
    const lng = parseCoord(c.req.query('lng'), 180);
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      return c.json({ error: 'invalid_coordinates' }, 400);
    }
    try {
      const results = await photon(c, '/reverse', {
        lat: String(lat),
        lon: String(lng),
        lang: 'fr',
        limit: '1',
      });
      return c.json({ result: results[0] ?? null });
    } catch {
      return c.json({ error: 'geocoder_unavailable' }, 502);
    }
  });

  return routes;
}
