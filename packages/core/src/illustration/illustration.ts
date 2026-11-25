import { z } from 'zod';

/**
 * Illustrations des voyages : dessins « flat » du projet (une scène et un pictogramme par thème,
 * dans `apps/web/src/lib/illustrations/`). Un voyage n'enregistre que l'identifiant ; sans choix,
 * l'illustration est suggérée à partir du nom et des lieux (`suggestIllustration`).
 */
const IDS = [
  'randonnee',
  'plage',
  'montagne',
  'roadtrip',
  'van',
  'camping-car',
  'camping',
  'velo',
  'moto',
  'ville',
  'ski',
  'train',
  'avion',
  'croisiere',
  'voilier',
  'lac',
  'foret',
  'desert',
  'ile',
  'kayak',
  'campagne',
  'safari',
  'festival',
  'voyage',
] as const;

export const IllustrationId = z.enum(IDS);
export type IllustrationId = z.infer<typeof IllustrationId>;

const LABELS: Record<IllustrationId, string> = {
  randonnee: 'Randonnée',
  plage: 'Plage',
  montagne: 'Montagne',
  roadtrip: 'Roadtrip en voiture',
  van: 'Van',
  'camping-car': 'Camping-car',
  camping: 'Camping',
  velo: 'Vélo',
  moto: 'Moto',
  ville: 'Ville',
  ski: 'Ski',
  train: 'Train',
  avion: 'Avion',
  croisiere: 'Croisière',
  voilier: 'Voilier',
  lac: 'Lac',
  foret: 'Forêt',
  desert: 'Désert',
  ile: 'Île',
  kayak: 'Kayak',
  campagne: 'Campagne',
  safari: 'Safari',
  festival: 'Festival',
  voyage: 'Voyage',
};

/** Illustrations dans l'ordre de la grille de choix. */
export const ILLUSTRATIONS: readonly { id: IllustrationId; label: string }[] = IDS.map((id) => ({
  id,
  label: LABELS[id],
}));

export function illustrationLabel(id: IllustrationId): string {
  return LABELS[id];
}

/** Identifiant connu, ou null (valeur absente, retirée de la liste, ancienne photo…). */
export function parseIllustration(raw: unknown): IllustrationId | null {
  const parsed = IllustrationId.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Mots-clés de chaque thème (sans accents, en minuscules ; une expression de plusieurs mots est
 * cherchée telle quelle), dans l'ordre de priorité : le moyen de transport le plus précis d'abord
 * (« camping-car » avant « camping », « road trip en van » est un voyage en van), puis les
 * activités, enfin les paysages. Le voyage générique n'est jamais suggéré.
 */
const KEYWORDS: [IllustrationId, string[]][] = [
  ['camping-car', ['camping car', 'campingcar', 'motorhome', 'autocaravane', 'caravane']],
  ['van', ['van', 'vans', 'vanlife', 'fourgon', 'fourgonnette', 'combi', 'campervan']],
  ['moto', ['moto', 'motos', 'motard', 'motarde']],
  ['velo', ['velo', 'velos', 'cyclo', 'cyclotourisme', 'bikepacking', 'bicyclette', 'vtt']],
  ['roadtrip', ['road trip', 'roadtrip', 'road', 'voiture', 'route']],
  ['train', ['train', 'trains', 'interrail', 'transsiberien', 'tgv']],
  ['avion', ['avion', 'vol', 'vols']],
  ['croisiere', ['croisiere', 'croisieres', 'paquebot', 'ferry', 'bateau', 'peniche']],
  ['voilier', ['voilier', 'voile', 'catamaran', 'navigation']],
  ['kayak', ['kayak', 'canoe', 'rafting', 'paddle']],
  ['safari', ['safari', 'safaris', 'savane']],
  ['festival', ['festival', 'festivals', 'concert', 'concerts', 'carnaval']],
  ['ski', ['ski', 'skis', 'snowboard', 'raquettes', 'neige', 'sports d hiver', 'sport d hiver']],
  [
    'randonnee',
    [
      'randonnee',
      'randonnees',
      'rando',
      'randos',
      'trek',
      'trekking',
      'gr',
      'refuge',
      'compostelle',
      'tour du mont blanc',
      'tmb',
    ],
  ],
  ['camping', ['camping', 'campings', 'tente', 'bivouac', 'glamping']],
  ['ile', ['ile', 'iles', 'archipel', 'atoll']],
  [
    'plage',
    ['plage', 'plages', 'mer', 'bord de mer', 'cote', 'ocean', 'littoral', 'surf', 'balneaire'],
  ],
  ['lac', ['lac', 'lacs', 'etang']],
  ['desert', ['desert', 'dune', 'dunes', 'sahara', 'oasis']],
  [
    'montagne',
    ['montagne', 'montagnes', 'mont', 'massif', 'sommet', 'alpes', 'pyrenees', 'dolomites'],
  ],
  ['foret', ['foret', 'forets', 'bois', 'jungle']],
  ['campagne', ['campagne', 'gite', 'ferme', 'vignoble', 'vignes', 'vendanges']],
  [
    'ville',
    [
      'ville',
      'city',
      'city trip',
      'citytrip',
      'capitale',
      'paris',
      'londres',
      'rome',
      'new york',
      'barcelone',
      'berlin',
      'lisbonne',
      'amsterdam',
      'prague',
      'vienne',
      'venise',
      'madrid',
      'bruxelles',
      'istanbul',
      'tokyo',
    ],
  ],
];

/**
 * Mots-clés cherchés dans les lieux des étapes : seulement des paysages, et plus stricts que pour
 * le nom. Une gare, un aéroport ou une ville se trouvent dans presque tous les voyages ; « Île de
 * la Cité », « Bois de Boulogne », « Mer de Glace » ou « Côte de Nuits » ne disent rien non plus
 * d'une île, d'une forêt ou de la plage.
 */
const PLACE_KEYWORDS: [IllustrationId, string[]][] = [
  ['ski', ['ski', 'station de ski']],
  ['randonnee', ['refuge', 'gr', 'sentier']],
  ['camping', ['camping', 'bivouac']],
  ['plage', ['plage', 'plages']],
  ['lac', ['lac', 'lacs', 'etang']],
  ['desert', ['desert', 'dune', 'dunes', 'oasis']],
  ['montagne', ['montagne', 'sommet', 'col', 'pic', 'aiguille', 'glacier']],
  ['foret', ['foret', 'forets']],
];

/** Texte comparable : minuscules, sans accents, mots séparés d'une espace (« GR20 » → « gr 20 »). */
function normalize(text: string): string {
  const words = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${words} `;
}

function matches(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(` ${keyword} `));
}

/**
 * Illustration déduite du nom du voyage, sinon des paysages de ses lieux ; null sans
 * correspondance (l'interface affiche alors l'initiale du voyage).
 */
export function suggestIllustration(name: string, places: string[]): IllustrationId | null {
  const fromName = normalize(name);
  for (const [id, keywords] of KEYWORDS) {
    if (matches(fromName, keywords)) return id;
  }
  const fromPlaces = places.map(normalize);
  for (const [id, keywords] of PLACE_KEYWORDS) {
    if (fromPlaces.some((place) => matches(place, keywords))) return id;
  }
  return null;
}
