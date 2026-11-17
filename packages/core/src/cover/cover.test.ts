import { describe, expect, it } from 'vitest';
import { commonsSearchUrl, coverQuery, parseCommonsResponse, TripCover } from './cover';

/** Page de fichier Commons (API `formatversion=2`). */
function page(index: number, title: string, info: Record<string, unknown> = {}) {
  return {
    index,
    title,
    imageinfo: [
      {
        url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${index}.jpg`,
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${index}.jpg/1280px-${index}.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${index}.jpg`,
        width: 4000,
        height: 2600,
        mime: 'image/jpeg',
        extmetadata: {
          Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Jean">Jean Dupont</a>' },
          LicenseShortName: { value: 'CC BY-SA 4.0' },
        },
        ...info,
      },
    ],
  };
}

describe('coverQuery', () => {
  it('garde la destination du nom du voyage, sans les mots génériques ni l’année', () => {
    expect(coverQuery('Voyage test Alpes', [])).toBe('Alpes');
    expect(coverQuery('Week-end à Marseille', [])).toBe('Marseille');
    expect(coverQuery('Paris en famille 2027', [])).toBe('Paris');
    expect(coverQuery('Lac d’Annecy', [])).toBe('Lac Annecy');
  });

  it('se rabat sur le premier lieu des étapes si le nom ne dit rien', () => {
    expect(coverQuery('Vacances 2026', ['MuCEM', 'Vieux-Port'])).toBe('MuCEM');
    expect(coverQuery('Mon voyage', [])).toBe('');
  });
});

describe('commonsSearchUrl', () => {
  it('cherche des photos (fichiers bitmap) avec leurs crédits, sans effacer le chemin de base', () => {
    const url = commonsSearchUrl('http://localhost:8798/commons', 'Alpes');
    expect(url.startsWith('http://localhost:8798/commons/w/api.php?')).toBe(true);
    const params = Object.fromEntries(
      url
        .slice(url.indexOf('?') + 1)
        .split('&')
        .map((p) => p.split('=').map(decodeURIComponent)),
    );
    expect(params.gsrsearch).toBe('Alpes filetype:bitmap');
    expect(params.gsrnamespace).toBe('6');
    expect(params.iiprop).toContain('extmetadata');
    expect(params.iiurlwidth).toBe('1280');
  });
});

describe('parseCommonsResponse', () => {
  it('renvoie les photos dans l’ordre de la recherche, avec auteur et licence', () => {
    const covers = parseCommonsResponse({
      query: { pages: [page(2, 'File:Lac.jpg'), page(1, 'File:Alpes.jpg')] },
    });
    expect(covers.map((c) => c.url)).toEqual([
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/1.jpg/1280px-1.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/2.jpg/1280px-2.jpg',
    ]);
    expect(covers[0]).toEqual({
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/1.jpg/1280px-1.jpg',
      thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/1.jpg/640px-1.jpg',
      author: 'Jean Dupont',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:1.jpg',
    });
    expect(TripCover.safeParse(covers[0]).success).toBe(true);
  });

  it('écarte cartes, drapeaux, blasons, portraits et images trop petites', () => {
    const covers = parseCommonsResponse({
      query: {
        pages: [
          page(1, 'File:Map of the Alps.jpg'),
          page(2, 'File:Flag of France.jpg'),
          page(3, 'File:Blason Annecy.jpg'),
          page(4, 'File:Portrait.jpg', { width: 2000, height: 3000 }),
          page(5, 'File:Petite.jpg', { width: 640, height: 400 }),
          page(6, 'File:Logo.png', { mime: 'image/png' }),
          page(7, 'File:Mont Blanc.jpg'),
        ],
      },
    });
    expect(covers).toHaveLength(1);
    expect(covers[0]!.sourceUrl).toContain('7.jpg');
  });

  it('auteur et licence inconnus : valeurs par défaut lisibles', () => {
    const [cover] = parseCommonsResponse({
      query: { pages: [page(1, 'File:Alpes.jpg', { extmetadata: {} })] },
    });
    expect(cover!.author).toBe('Auteur inconnu');
    expect(cover!.license).toBe('Licence inconnue');
  });

  it('réponse vide ou inattendue : aucune photo', () => {
    expect(parseCommonsResponse({})).toEqual([]);
    expect(parseCommonsResponse(null)).toEqual([]);
    expect(parseCommonsResponse({ query: { pages: [{ title: 'File:X.jpg' }] } })).toEqual([]);
  });

  it('8 photos au plus', () => {
    const pages = Array.from({ length: 12 }, (_, i) => page(i + 1, `File:${i + 1}.jpg`));
    expect(parseCommonsResponse({ query: { pages } })).toHaveLength(8);
  });
});

describe('TripCover', () => {
  it('refuse une adresse qui n’est pas http(s)', () => {
    const ok = {
      url: 'https://upload.wikimedia.org/a.jpg',
      thumbUrl: 'https://upload.wikimedia.org/a.jpg',
      author: 'A',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    };
    expect(TripCover.safeParse(ok).success).toBe(true);
    expect(TripCover.safeParse({ ...ok, url: 'javascript:alert(1)' }).success).toBe(false);
  });
});
