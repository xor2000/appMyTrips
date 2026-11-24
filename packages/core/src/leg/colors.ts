/** Nombre de couleurs de la palette des trajets (celle des couches de la maquette). */
export const LEG_COLOR_COUNT = 8;

/** Variable CSS (définie par chaque thème) d'une couleur de la palette des trajets. */
export function legColorVar(index: number): string {
  return `--leg-${index + 1}`;
}

/**
 * Couleurs (rangs dans la palette) des trajets d'un jour, dans l'ordre du jour : la couleur
 * choisie, sinon celle qui suit le trajet précédent (le premier : la première couleur). Deux
 * trajets automatiques consécutifs n'ont donc jamais la même couleur.
 */
export function dayLegColors(legs: readonly { color: number | null }[]): number[] {
  let previous = -1;
  return legs.map((leg) => {
    previous = leg.color ?? (previous + 1) % LEG_COLOR_COUNT;
    return previous;
  });
}
