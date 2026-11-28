/**
 * Affichage de la journée sur la page d'un voyage, choisi sur « Mon compte » ou par le sélecteur
 * rapide de la page, mémorisé dans le navigateur (par appareil). Les deux affichages partagent
 * données, calculs, fenêtres d'édition et actions ; seule la présentation change.
 */
export const LAYOUTS = [
  {
    id: 'list',
    label: 'Liste et carte',
    hint: 'La journée en liste à gauche, la carte à droite',
  },
  {
    id: 'board',
    label: 'Plein écran',
    hint: 'Carte ou timeline sur tout l’écran, les jours en colonnes',
  },
] as const;

export type LayoutId = (typeof LAYOUTS)[number]['id'];

export const LAYOUT_KEY = 'mytrips.layout';

type LayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): LayoutStorage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Affichage mémorisé ; « list » s'il n'y en a pas, s'il est inconnu (dont l'ancienne « ligne de
 * métro », retirée) ou si le stockage est bloqué.
 */
export function readLayout(storage: LayoutStorage | null = defaultStorage()): LayoutId {
  try {
    const value = storage?.getItem(LAYOUT_KEY) ?? null;
    return LAYOUTS.some((l) => l.id === value) ? (value as LayoutId) : 'list';
  } catch {
    return 'list';
  }
}

/** Mémorise l'affichage (sans effet si le stockage est bloqué). */
export function saveLayout(id: LayoutId, storage: LayoutStorage | null = defaultStorage()) {
  try {
    storage?.setItem(LAYOUT_KEY, id);
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite seulement.
  }
}
