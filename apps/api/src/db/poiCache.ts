import type { Poi } from '@mytrips/core';

/** Durée de validité d'une case du cache. */
export const POI_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
/** D1 limite le nombre de paramètres liés par requête. */
const CHUNK = 50;

/** Cases encore valides parmi `keys` : clé → lieux. */
export async function getCachedPois(
  db: D1Database,
  keys: readonly string[],
  now = Date.now(),
): Promise<Map<string, Poi[]>> {
  const since = new Date(now - POI_CACHE_TTL_MS).toISOString();
  const found = new Map<string, Poi[]>();
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    const { results } = await db
      .prepare(
        `SELECT key, payload FROM poi_cache
         WHERE created_at > ? AND key IN (${chunk.map(() => '?').join(',')})`,
      )
      .bind(since, ...chunk)
      .all<{ key: string; payload: string }>();
    for (const row of results) found.set(row.key, JSON.parse(row.payload) as Poi[]);
  }
  return found;
}

/** Enregistre (ou remplace) des cases du cache. */
export async function putCachedPois(
  db: D1Database,
  entries: readonly { key: string; pois: Poi[] }[],
  source: Poi['source'],
  now = Date.now(),
): Promise<void> {
  if (entries.length === 0) return;
  const createdAt = new Date(now).toISOString();
  await db.batch(
    entries.map((e) =>
      db
        .prepare(
          'INSERT OR REPLACE INTO poi_cache (key, payload, source, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(e.key, JSON.stringify(e.pois), source, createdAt),
    ),
  );
}
