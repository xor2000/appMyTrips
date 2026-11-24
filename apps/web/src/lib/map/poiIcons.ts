import type { StepType } from '@mytrips/core';
import { mount, unmount } from 'svelte';
import { STEP_ICONS } from '#lib/steps/icons.ts';

/**
 * Icônes des pastilles de la découverte. La carte dessine les pastilles en WebGL : elle ne peut pas
 * y placer un composant Lucide. On rend donc l'icône du type (`STEP_ICONS`, la même que dans la
 * timeline) en SVG autonome, que la carte charge comme image (`map.addImage`).
 */

/** Taille affichée de l'icône dans la pastille (px CSS). */
export const POI_ICON_SIZE = 13;

/** Densité des images : nettes sur les écrans haute densité. */
export const POI_ICON_PIXEL_RATIO = 2;

/** SVG autonome (avec `xmlns`) de l'icône d'un type, à la taille et dans la couleur données. */
export function stepIconSvg(type: StepType, color: string, size: number): string {
  const target = document.createElement('div');
  const component = mount(STEP_ICONS[type], {
    target,
    props: { size, color, strokeWidth: 2.4 },
  });
  const svg = target.querySelector('svg');
  if (svg && !svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = svg?.outerHTML ?? '';
  void unmount(component);
  return markup;
}

/** Image chargée de l'icône d'un type, prête pour `map.addImage` (avec `POI_ICON_PIXEL_RATIO`). */
export async function loadStepIconImage(type: StepType, color: string): Promise<HTMLImageElement> {
  const image = new Image();
  const svg = stepIconSvg(type, color, POI_ICON_SIZE * POI_ICON_PIXEL_RATIO);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}
