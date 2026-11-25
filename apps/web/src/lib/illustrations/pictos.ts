import { byId } from './files.ts';

/**
 * Pictogrammes (48 × 48), pour les vignettes de 26 et 44 px : petits, chargés avec la page.
 * Fichiers du dépôt uniquement, affichés tels quels (`{@html}`).
 */
export const PICTOS = byId(
  import.meta.glob<string>('./pictos/*.svg', { query: '?raw', import: 'default', eager: true }),
);
