import type { TripCover } from '@mytrips/core';

/** Durée de validité d'une recherche de photos en cache. */
export const COVER_CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

/** Photos en cache pour ces mots-clés (normalisés), ou null si absentes ou périmées. */
export async function getCachedCovers(
  db: D1Database,
  query: string,
  now = Date.now(),
): Promise<TripCover[] | null> {
  const since = new Date(now - COVER_CACHE_TTL_MS).toISOString();
  const row = await db
    .prepare('SELECT payload FROM cover_cache WHERE query = ? AND created_at > ?')
    .bind(query, since)
    .first<{ payload: string }>();
  return row ? (JSON.parse(row.payload) as TripCover[]) : null;
}

/** Enregistre (ou remplace) le résultat d'une recherche. */
export async function putCachedCovers(
  db: D1Database,
  query: string,
  covers: TripCover[],
  now = Date.now(),
): Promise<void> {
  await db
    .prepare('INSERT OR REPLACE INTO cover_cache (query, payload, created_at) VALUES (?, ?, ?)')
    .bind(query, JSON.stringify(covers), new Date(now).toISOString())
    .run();
}
