import {
  POI_CATEGORY_INFO,
  STEP_TYPE_INFO,
  STEP_TYPES,
  type Place,
  type Poi,
  type StepType,
} from '@mytrips/core';
import { groupPoisByCategory } from '#lib/poi/explore.ts';

/**
 * Groupe de résultats d'une recherche de lieux (« Rechercher » ou « Explorer la zone ») : un titre
 * (icône du type, libellé, nombre) avec un filet, puis ses lieux.
 */
export interface ResultGroup<T> {
  key: string;
  label: string;
  /** Type d'étape dont l'icône précède le libellé. */
  icon: StepType;
  items: T[];
}

/**
 * Résultats de « Rechercher » (géocodage) groupés par type d'étape, dans l'ordre des types
 * (`STEP_TYPES`), sans groupe vide ; dans un groupe, l'ordre reçu (pertinence) est gardé, doublons
 * du géocodeur compris.
 */
export function placeResultGroups(places: readonly Place[]): ResultGroup<Place>[] {
  return STEP_TYPES.map((type) => ({
    key: type,
    label: STEP_TYPE_INFO[type].label,
    icon: type,
    items: places.filter((p) => p.type === type),
  })).filter((g) => g.items.length > 0);
}

/** Résultats d'« Explorer la zone » groupés par catégorie de la découverte (`groupPoisByCategory`). */
export function poiResultGroups(pois: readonly Poi[]): ResultGroup<Poi>[] {
  return groupPoisByCategory(pois).map((g) => ({
    key: g.category,
    label: POI_CATEGORY_INFO[g.category].label,
    icon: POI_CATEGORY_INFO[g.category].stepType,
    items: g.pois,
  }));
}
