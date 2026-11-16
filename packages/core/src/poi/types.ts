import type { StepType } from '../step/types';
import type { PoiCategory } from './categories';

/** Lieu proposé par la découverte (Overpass ou Geoapify), au format normalisé. */
export interface Poi {
  /** Identifiant stable : `osm:<N|W|R><id>`, ou `geoapify:<place_id>` sans référence OSM. */
  id: string;
  /** Référence OSM (`N123`, `W456`…), au même format que `Step.osmRef`. */
  osmRef: string | null;
  name: string;
  category: PoiCategory;
  stepType: StepType;
  lat: number;
  lng: number;
  address: string | null;
  openingHours: string | null;
  /** Site web, uniquement en http(s). */
  website: string | null;
  phone: string | null;
  cuisine: string | null;
  wikidata: string | null;
  /** Tag OSM `wikipedia` : « langue:titre ». */
  wikipedia: string | null;
  source: 'overpass' | 'geoapify';
}

/** Résumé Wikipédia d'un lieu (chargé à la demande). */
export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail: string | null;
  url: string;
}

/** Valeur http(s) seulement : un lien venant d'OSM est affiché tel quel dans l'interface. */
export function httpUrlOrNull(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\/[^\s/?#]+\S*$/i.test(value.trim())
    ? value.trim()
    : null;
}

/** Chaîne non vide, sinon null. */
export function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
