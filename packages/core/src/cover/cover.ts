import { z } from 'zod';

/**
 * Photo de couverture d'un voyage, trouvée sur Wikimedia Commons. Le crédit (auteur, licence,
 * lien vers la page du fichier) est obligatoire pour une photo sous licence libre.
 */
const HttpUrl = z
  .string()
  .max(2000)
  .regex(/^https?:\/\/[^\s/?#]+\S*$/i, 'Adresse http(s) attendue');

export const TripCover = z.object({
  /** Image large (1280 px), pour la mise en avant. */
  url: HttpUrl,
  /** Vignette (640 px), pour les cartes. */
  thumbUrl: HttpUrl,
  author: z.string().trim().min(1).max(200),
  license: z.string().trim().min(1).max(100),
  /** Page du fichier sur Commons (crédit). */
  sourceUrl: HttpUrl,
});
export type TripCover = z.infer<typeof TripCover>;

/** Nombre de photos proposées pour une recherche. */
export const MAX_COVERS = 8;

/** Mots qui ne disent rien de la destination (« Voyage test Alpes » → « Alpes »). */
const GENERIC_WORDS = new Set(
  [
    'voyage',
    'voyages',
    'trip',
    'test',
    'vacances',
    'séjour',
    'sejour',
    'week',
    'end',
    'weekend',
    'escapade',
    'road',
    'roadtrip',
    'tour',
    'famille',
    'amis',
    'mon',
    'ma',
    'mes',
    'notre',
    'nos',
    'en',
    'à',
    'a',
    'au',
    'aux',
    'de',
    'du',
    'des',
    'd',
    'la',
    'le',
    'les',
    'l',
    'et',
    'avec',
    'pour',
    'entre',
    'dans',
    'sur',
  ].map((w) => w.toLowerCase()),
);

/**
 * Mots-clés de recherche d'une photo : le nom du voyage sans les mots génériques, les nombres ni
 * les années ; à défaut, le premier lieu des étapes ; chaîne vide s'il n'y a rien.
 */
export function coverQuery(name: string, places: string[]): string {
  const words = name
    .split(/[\s'’\-–,.;:!?()/]+/)
    .filter((w) => w !== '' && !/^\d+$/.test(w) && !GENERIC_WORDS.has(w.toLowerCase()));
  if (words.length > 0) return words.join(' ');
  return places.find((p) => p.trim() !== '')?.trim() ?? '';
}

/**
 * URL de recherche de photos sur l'API de Commons (fichiers bitmap de l'espace « Fichier »), avec
 * leur adresse en 1280 px, leur taille, leur type et leurs métadonnées de crédit. Construite par
 * concaténation : la base peut contenir un chemin (services factices des e2e).
 */
export function commonsSearchUrl(base: string, query: string): string {
  const params: [string, string][] = [
    ['action', 'query'],
    ['format', 'json'],
    ['formatversion', '2'],
    ['generator', 'search'],
    ['gsrnamespace', '6'],
    ['gsrlimit', '30'],
    ['gsrsearch', `${query} filetype:bitmap`],
    ['prop', 'imageinfo'],
    ['iiprop', 'url|size|mime|extmetadata'],
    ['iiextmetadatafilter', 'Artist|LicenseShortName'],
    ['iiurlwidth', '1280'],
  ];
  const search = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${base.replace(/\/+$/, '')}/w/api.php?${search}`;
}

/** Titres de fichiers qui ne sont pas des photos de paysage. */
const NOT_A_PHOTO =
  /\b(map|carte|karte|mapa|locator|location|flag|drapeau|blason|coat of arms|wappen|logo|emblem|diagram|plan|scheme|sch[ée]ma)\b/i;

const MIN_WIDTH = 1000;
const MIN_RATIO = 1.2;

interface CommonsImageInfo {
  url?: unknown;
  thumburl?: unknown;
  descriptionurl?: unknown;
  width?: unknown;
  height?: unknown;
  mime?: unknown;
  extmetadata?: Record<string, { value?: unknown } | undefined>;
}

interface CommonsPage {
  index?: unknown;
  title?: unknown;
  imageinfo?: CommonsImageInfo[];
}

/** Texte brut d'une valeur de métadonnée Commons (souvent du HTML). */
function plainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Photos d'une réponse de recherche Commons, dans l'ordre de pertinence : JPEG en paysage d'au
 * moins 1000 px, sans cartes, drapeaux ni blasons ; 8 au plus. Réponse inattendue : aucune.
 */
export function parseCommonsResponse(body: unknown): TripCover[] {
  const pages = (body as { query?: { pages?: unknown } } | null)?.query?.pages;
  if (!Array.isArray(pages)) return [];
  const covers: TripCover[] = [];
  const sorted = [...(pages as CommonsPage[])].sort(
    (a, b) => (Number(a.index) || 0) - (Number(b.index) || 0),
  );
  for (const page of sorted) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const title = typeof page.title === 'string' ? page.title : '';
    const width = Number(info.width);
    const height = Number(info.height);
    if (info.mime !== 'image/jpeg' || NOT_A_PHOTO.test(title)) continue;
    if (!(width >= MIN_WIDTH && height > 0 && width / height >= MIN_RATIO)) continue;
    const large = typeof info.thumburl === 'string' ? info.thumburl : info.url;
    const candidate = {
      url: large,
      thumbUrl: typeof large === 'string' ? large.replace('/1280px-', '/640px-') : large,
      author: plainText(info.extmetadata?.Artist?.value) || 'Auteur inconnu',
      license: plainText(info.extmetadata?.LicenseShortName?.value) || 'Licence inconnue',
      sourceUrl: info.descriptionurl,
    };
    const parsed = TripCover.safeParse({
      ...candidate,
      author: candidate.author.slice(0, 200),
      license: candidate.license.slice(0, 100),
    });
    if (parsed.success) covers.push(parsed.data);
    if (covers.length === MAX_COVERS) break;
  }
  return covers;
}
