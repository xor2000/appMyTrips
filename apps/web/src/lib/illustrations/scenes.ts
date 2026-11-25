import { byId } from './files.ts';

/**
 * Scènes (160 × 100), pour la grille de choix et l'aperçu. Ce module n'est importé qu'à la
 * demande (`loadScenes` d'`Illustration.svelte`) : les scènes restent hors du chargement initial.
 * Fichiers du dépôt uniquement, affichés tels quels (`{@html}`).
 */
export const SCENES = byId(
  import.meta.glob<string>('./scenes/*.svg', { query: '?raw', import: 'default', eager: true }),
);
