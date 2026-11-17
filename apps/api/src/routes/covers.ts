import { commonsSearchUrl, parseCommonsResponse, type TripCover } from '@mytrips/core';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth/session';
import { getCachedCovers, putCachedCovers } from '../db/coverCache';
import { USER_AGENT } from '../poi/providers';

const DEFAULT_COMMONS_URL = 'https://commons.wikimedia.org';
const MAX_QUERY = 100;

const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const SOURCE_HOSTS = new Set(['commons.wikimedia.org']);

function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

function hostAllowed(url: string, hosts: Set<string>, extraOrigin: string | null): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' && hosts.has(u.hostname)) || u.origin === extraOrigin;
  } catch {
    return false;
  }
}

/**
 * Une photo enregistrée ne peut venir que de Wikimedia (images et page du fichier), ou du service
 * de `COMMONS_URL` (services factices des e2e) : une adresse quelconque permettrait à l'éditeur
 * d'un voyage partagé de suivre ses lecteurs par l'image.
 */
export function coverIsAllowed(cover: TripCover, commonsUrl: string | undefined): boolean {
  const extra = originOf(commonsUrl);
  return (
    hostAllowed(cover.url, IMAGE_HOSTS, extra) &&
    hostAllowed(cover.thumbUrl, IMAGE_HOSTS, extra) &&
    hostAllowed(cover.sourceUrl, SOURCE_HOSTS, extra)
  );
}

/**
 * Recherche de photos de couverture sur Wikimedia Commons, par le Worker (aucun appel depuis le
 * navigateur), avec cache D1 de 30 jours par mots-clés. Une réponse en erreur n'est pas mise en
 * cache ; une recherche sans résultat l'est (liste vide).
 */
export function coverRoutes(fetchImpl: typeof fetch) {
  const routes = new Hono<AuthEnv>();

  routes.get('/', async (c) => {
    const raw = (c.req.query('q') ?? '').trim().replace(/\s+/g, ' ');
    if (raw === '' || raw.length > MAX_QUERY) return c.json({ error: 'invalid_query' }, 400);
    const key = raw.toLowerCase();
    const db = c.env.DB;

    const cached = await getCachedCovers(db, key);
    if (cached) return c.json({ covers: cached });

    // Politique de Wikimedia : User-Agent identifiable, avec un moyen de contact s'il est connu.
    const userAgent = c.env.CONTACT_URL ? `${USER_AGENT} +${c.env.CONTACT_URL}` : USER_AGENT;
    let covers;
    try {
      const res = await fetchImpl(commonsSearchUrl(c.env.COMMONS_URL ?? DEFAULT_COMMONS_URL, raw), {
        headers: { 'user-agent': userAgent, accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Commons ${res.status}`);
      covers = parseCommonsResponse(await res.json());
    } catch {
      return c.json({ error: 'covers_unavailable' }, 502);
    }
    await putCachedCovers(db, key, covers);
    return c.json({ covers });
  });

  return routes;
}
