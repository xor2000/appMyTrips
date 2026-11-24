import type { Page } from '@playwright/test';

/** Accès de test exposés par la carte (TripMap.svelte) : les lieux sont dessinés en WebGL. */
export interface MapTestWindow {
  __mapPoisForTests?: () => {
    id: string;
    name: string;
    active: boolean;
    /** Image de l'icône du type, et si elle est chargée (pas l'image vide de secours). */
    icon: string;
    iconReady: boolean;
  }[];
  __mapProjectForTests?: (lngLat: [number, number]) => { x: number; y: number };
  __mapZoomForTests?: () => number;
}

/** Clic (ou clic droit) sur la carte, à l'endroit d'un point géographique. */
export async function clickMapAt(
  page: Page,
  lngLat: [number, number],
  options: { button?: 'left' | 'right' } = {},
) {
  const point = await page.evaluate(
    (position) => (window as MapTestWindow).__mapProjectForTests?.(position),
    lngLat,
  );
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  // Taille d'affichage (zoom CSS) : la boîte est à l'écran, la projection en pixels de la carte.
  const width = await canvas.evaluate((el) => (el as HTMLElement).offsetWidth);
  if (!point || !box) throw new Error('carte indisponible');
  const ratio = box.width / width;
  await page.mouse.click(box.x + point.x * ratio, box.y + point.y * ratio, options);
}
