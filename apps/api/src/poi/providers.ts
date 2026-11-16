import {
  geoapifyParams,
  overpassQuery,
  poisFromGeoapify,
  poisFromOverpass,
  type Bbox,
  type Poi,
  type PoiCategory,
} from '@mytrips/core';
import type { Bindings } from '../env';

/** Identification demandée par les politiques d'usage d'Overpass et Wikipédia (sans donnée personnelle). */
export const USER_AGENT = 'MyTrips/0.1 (application personnelle de carnet de voyage)';

const DEFAULT_OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const DEFAULT_GEOAPIFY_URL = 'https://api.geoapify.com';
/** Au-delà, on passe au fournisseur suivant. */
const TIMEOUT_MS = 8000;

/** Fournisseur de lieux : renvoie les lieux des catégories dans la zone, ou lève une erreur. */
export interface PoiProvider {
  name: Poi['source'];
  url: string;
  search(bbox: Bbox, categories: readonly PoiCategory[]): Promise<Poi[]>;
}

export class PoiUnavailableError extends Error {
  constructor(readonly failures: string[]) {
    super(`Aucun fournisseur de lieux disponible : ${failures.join(' ; ')}`);
  }
}

function overpassProvider(url: string, fetchImpl: typeof fetch): PoiProvider {
  return {
    name: 'overpass',
    url,
    async search(bbox, categories) {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery(bbox, categories))}`,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { remark?: unknown };
      // Délai ou mémoire dépassés côté Overpass : réponse 200 mais tronquée, à ne pas mettre en cache.
      if (typeof body.remark === 'string' && /error/i.test(body.remark)) {
        throw new Error(`réponse incomplète (${body.remark})`);
      }
      return poisFromOverpass(body, categories);
    },
  };
}

function geoapifyProvider(base: string, apiKey: string, fetchImpl: typeof fetch): PoiProvider {
  return {
    name: 'geoapify',
    url: base,
    async search(bbox, categories) {
      const url = new URL('/v2/places', base);
      for (const [k, v] of Object.entries(geoapifyParams(bbox, categories))) {
        url.searchParams.set(k, v);
      }
      url.searchParams.set('apiKey', apiKey);
      const res = await fetchImpl(url.toString(), {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return poisFromGeoapify(await res.json(), categories);
    },
  };
}

/** Fournisseurs dans l'ordre d'essai : instances Overpass, puis Geoapify si une clé est configurée. */
export function poiProviders(env: Bindings, fetchImpl: typeof fetch): PoiProvider[] {
  const overpassUrls = env.OVERPASS_URLS
    ? env.OVERPASS_URLS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_OVERPASS_URLS;
  const providers = overpassUrls.map((url) => overpassProvider(url, fetchImpl));
  if (env.GEOAPIFY_API_KEY) {
    providers.push(
      geoapifyProvider(env.GEOAPIFY_URL ?? DEFAULT_GEOAPIFY_URL, env.GEOAPIFY_API_KEY, fetchImpl),
    );
  }
  return providers;
}

/**
 * Essaie les fournisseurs dans l'ordre (erreur HTTP, 429, délai dépassé ou réseau : suivant).
 * Lève PoiUnavailableError si tous échouent.
 */
export async function searchWithFallback(
  providers: readonly PoiProvider[],
  bbox: Bbox,
  categories: readonly PoiCategory[],
): Promise<{ pois: Poi[]; source: Poi['source'] }> {
  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const pois = await provider.search(bbox, categories);
      if (provider.name === 'geoapify') {
        // Quota gratuit limité : chaque appel de secours est tracé dans les journaux du Worker.
        console.warn(`poi : secours Geoapify (${failures.join(' ; ')})`);
      }
      return { pois, source: provider.name };
    } catch (e) {
      failures.push(`${provider.url} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new PoiUnavailableError(failures);
}
