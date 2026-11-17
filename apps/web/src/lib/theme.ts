/**
 * Thème de l'interface, choisi sur « Mon compte » et mémorisé dans le navigateur (par appareil).
 * Chaque thème est un fichier CSS de `lib/styles/themes/` activé par `data-theme` sur <html> ;
 * « auto » retire l'attribut (Pastel ludique, clair ou sombre selon le système).
 *
 * `src/app.html` refait la même lecture avant le premier affichage (pas de flash de thème) :
 * garder sa liste de thèmes et sa clé alignées sur celles-ci (vérifié par theme.test.ts).
 */
export const THEMES = [
  { id: 'auto', label: 'Automatique', hint: 'Pastel ludique, clair ou sombre selon le système' },
  { id: 'pastel-light', label: 'Pastel ludique clair', hint: 'Aplats pastel, pastilles pleines' },
  { id: 'pastel-dark', label: 'Pastel ludique sombre', hint: 'Le même, sur fond sombre' },
  { id: 'carnet', label: 'Carnet clair', hint: 'Cartes blanches, icônes teintées, plus sobre' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const THEME_KEY = 'mytrips.theme';

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): ThemeStorage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Thème mémorisé ; « auto » s'il n'y en a pas, s'il est inconnu ou si le stockage est bloqué. */
export function readTheme(storage: ThemeStorage | null = defaultStorage()): ThemeId {
  try {
    const value = storage?.getItem(THEME_KEY) ?? null;
    return isThemeId(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** Applique le thème à la page. */
export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement) {
  if (id === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
}

/** Applique le thème et le mémorise (le stockage bloqué n'empêche pas de l'appliquer). */
export function saveTheme(id: ThemeId, storage: ThemeStorage | null = defaultStorage()) {
  applyTheme(id);
  try {
    if (id === 'auto') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, id);
  } catch {
    // Stockage indisponible : le thème vaut pour cette visite seulement.
  }
}
