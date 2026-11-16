import { describe, expect, it, vi } from 'vitest';
import { glyphUrls, prefetchAll, resolveTileTemplate, tileUrl } from './prefetch.ts';

const STYLE = {
  version: 8,
  glyphs: 'https://tiles.example/fonts/{fontstack}/{range}.pbf',
  sources: {
    ne: { type: 'raster', tiles: ['https://tiles.example/ne/{z}/{x}/{y}.png'] },
    openmaptiles: { type: 'vector', url: 'https://tiles.example/planet' },
  },
  layers: [
    { id: 'a', layout: { 'text-font': ['Noto Sans Regular'] } },
    { id: 'b', layout: { 'text-font': ['Noto Sans Bold'] } },
    { id: 'c', layout: { 'text-font': ['Noto Sans Regular'] } },
  ],
};

const json = (body: unknown) => new Response(JSON.stringify(body));

describe('modèle d’URL des tuiles', () => {
  it('suit le style puis le TileJSON de la source vectorielle', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith('/planet')
        ? json({ tiles: ['https://tiles.example/planet/2026/{z}/{x}/{y}.pbf'] })
        : json(STYLE),
    );
    const { template, style } = await resolveTileTemplate(
      'https://tiles.example/styles/liberty',
      fetcher as unknown as typeof fetch,
    );
    expect(template).toBe('https://tiles.example/planet/2026/{z}/{x}/{y}.pbf');
    expect(style).toEqual(STYLE);
    expect(tileUrl(template!, { z: 10, x: 529, y: 364 })).toBe(
      'https://tiles.example/planet/2026/10/529/364.pbf',
    );
  });

  it('style sans source vectorielle : null', async () => {
    const fetcher = vi.fn(async () => json({ version: 8, sources: {}, layers: [] }));
    expect(
      (await resolveTileTemplate('s', fetcher as unknown as typeof fetch)).template,
    ).toBeNull();
  });

  it('polices des étiquettes : plages latines de chaque police utilisée', () => {
    const urls = glyphUrls(STYLE);
    expect(urls).toContain('https://tiles.example/fonts/Noto%20Sans%20Regular/0-255.pbf');
    expect(urls).toContain('https://tiles.example/fonts/Noto%20Sans%20Bold/256-511.pbf');
    expect(urls).toHaveLength(8);
  });
});

describe('prefetchAll', () => {
  it('4 requêtes en parallèle au plus, progression et échecs comptés', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetcher = vi.fn(async (url: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return new Response('x', { status: url.endsWith('/7') ? 500 : 200 });
    });
    const progress: number[] = [];
    const result = await prefetchAll(
      Array.from({ length: 10 }, (_, i) => `https://t/${i}`),
      { fetcher: fetcher as unknown as typeof fetch, onProgress: (done) => progress.push(done) },
    );
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(result).toEqual({ done: 10, failed: 1 });
    expect(progress.at(-1)).toBe(10);
  });

  it('espace de stockage plein : arrêt avec un message clair', async () => {
    const fetcher = vi.fn(async () => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await expect(
      prefetchAll(['https://t/1'], { fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow('Espace de stockage insuffisant : libère d’autres voyages hors ligne.');
  });

  it('peut être interrompu', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async () => {
      controller.abort();
      return new Response('x');
    });
    const result = await prefetchAll(['a', 'b', 'c', 'd', 'e', 'f'], {
      fetcher: fetcher as unknown as typeof fetch,
      signal: controller.signal,
      concurrency: 1,
    });
    expect(result.done).toBeLessThan(6);
  });
});
