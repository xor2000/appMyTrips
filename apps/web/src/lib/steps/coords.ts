/** Nombre décimal (point comme séparateur décimal), signe facultatif. */
const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

function toNumber(text: string): number | null {
  const t = text.trim();
  return DECIMAL.test(t) ? Number(t) : null;
}

/**
 * Coordonnées GPS saisies en degrés décimaux : latitude et longitude dans deux champs, ou un
 * couple « lat, lng » collé dans le premier (séparé par une virgule, un point-virgule ou des
 * espaces). Null si la saisie n'est pas un point valide (-90 à 90, -180 à 180).
 */
export function parseLatLng(latText: string, lngText = ''): { lat: number; lng: number } | null {
  let parts = [latText, lngText];
  if (lngText.trim() === '') {
    parts = latText
      .trim()
      .split(/\s*[,;]\s*|\s+/)
      .filter((p) => p !== '');
    if (parts.length !== 2) return null;
  }
  const lat = toNumber(parts[0] ?? '');
  const lng = toNumber(parts[1] ?? '');
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Même point, à la précision des champs de position (6 décimales, environ 10 cm) : un lieu choisi
 * n'est pas « déplacé » parce que la fenêtre a arrondi ses coordonnées.
 */
export function samePoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): boolean {
  return a.lat.toFixed(6) === b.lat.toFixed(6) && a.lng.toFixed(6) === b.lng.toFixed(6);
}
