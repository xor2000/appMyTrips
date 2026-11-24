/**
 * Taille d'affichage (menu du profil), comme dans appMyBank : zoom de toute la page, à la manière de
 * celui du navigateur, gardé dans le navigateur ; 100 % par défaut. `global.css` l'applique par la
 * variable `--zoom` posée sur `<html>` (dès le chargement par le script de `app.html`).
 */
export const SCALES = [80, 90, 100] as const;
export type Scale = (typeof SCALES)[number];

export const SCALE_KEY = 'mytrips.scale';
const DEFAULT: Scale = 100;

export function initialScale(): Scale {
  try {
    const value = Number(localStorage.getItem(SCALE_KEY));
    return SCALES.find((s) => s === value) ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function applyScale(value: Scale): void {
  document.documentElement.style.setProperty('--zoom', String(value / 100));
}

/** Taille courante, partagée par tous les écrans. */
export const scale = $state<{ value: Scale }>({ value: initialScale() });

export function setScale(value: Scale): void {
  scale.value = value;
  applyScale(value);
  try {
    localStorage.setItem(SCALE_KEY, String(value));
  } catch {
    // Stockage bloqué : le choix ne vaut que pour cette page.
  }
}
