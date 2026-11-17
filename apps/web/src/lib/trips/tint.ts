/** Teintes des voyages sans photo, prises dans les couleurs des types d'étape. */
const TINTS = [
  '--type-poi',
  '--type-hotel',
  '--type-food',
  '--type-museum',
  '--type-hike',
  '--type-air',
];

/** Teinte stable d'un voyage (même identifiant, même couleur). */
export function tripTint(id: string): string {
  return TINTS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length]!;
}
