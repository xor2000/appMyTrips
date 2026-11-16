import type { ZTile } from '@mytrips/core';

type StyleJson = {
  glyphs?: string;
  sources?: Record<string, { type?: string; url?: string; tiles?: string[] }>;
  layers?: { layout?: Record<string, unknown> }[];
};

/**
 * Modèle d'URL des tuiles vectorielles : style, puis TileJSON de sa source vectorielle (son URL est
 * versionnée chez OpenFreeMap). null si le style n'a pas de source vectorielle.
 */
export async function resolveTileTemplate(
  styleUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ template: string | null; style: StyleJson }> {
  const style = (await (await fetcher(styleUrl)).json()) as StyleJson;
  const source = Object.values(style.sources ?? {}).find((s) => s.type === 'vector');
  if (!source) return { template: null, style };
  if (source.tiles?.[0]) return { template: source.tiles[0], style };
  if (!source.url) return { template: null, style };
  const tilejson = (await (await fetcher(source.url)).json()) as { tiles?: string[] };
  return { template: tilejson.tiles?.[0] ?? null, style };
}

export const tileUrl = (template: string, t: ZTile) =>
  template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));

/** Plages de caractères latines (0–1023) des polices utilisées par les étiquettes du style. */
export function glyphUrls(style: StyleJson): string[] {
  if (!style.glyphs) return [];
  const fonts = new Set<string>();
  for (const layer of style.layers ?? []) {
    const font = layer.layout?.['text-font'];
    if (Array.isArray(font)) for (const f of font) if (typeof f === 'string') fonts.add(f);
  }
  const ranges = ['0-255', '256-511', '512-767', '768-1023'];
  return [...fonts].flatMap((font) =>
    ranges.map((range) =>
      style.glyphs!.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range),
    ),
  );
}

const QUOTA_MESSAGE = 'Espace de stockage insuffisant : libère d’autres voyages hors ligne.';

/**
 * Précharge des URL (le service worker les met en cache) : `concurrency` requêtes au plus en
 * parallèle (4 par défaut, pour ménager les serveurs de tuiles), progression, échecs comptés.
 * S'arrête avec un message clair si l'espace de stockage est plein.
 */
export async function prefetchAll(
  urls: readonly string[],
  options: {
    fetcher?: typeof fetch;
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<{ done: number; failed: number }> {
  const fetcher = options.fetcher ?? fetch;
  let next = 0;
  let done = 0;
  let failed = 0;
  let quota = false;
  async function worker() {
    while (next < urls.length && !quota && !options.signal?.aborted) {
      const url = urls[next++]!;
      try {
        const res = await fetcher(url, { signal: options.signal });
        if (!res.ok) failed++;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') quota = true;
        else if (!(e instanceof DOMException && e.name === 'AbortError')) failed++;
      }
      done++;
      options.onProgress?.(done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: options.concurrency ?? 4 }, worker));
  if (quota) throw new Error(QUOTA_MESSAGE);
  return { done, failed };
}
