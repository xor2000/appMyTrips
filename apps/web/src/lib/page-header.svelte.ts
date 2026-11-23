import type { Snippet } from 'svelte';

/**
 * Ce qu'une page place dans l'en-tête de l'application, sur la même ligne que le logo, le choix
 * du voyage et le profil : son contenu (la page voyage y met ses jours et ses actions) et
 * l'action de la roue crantée (paramètres du voyage ouvert, si l'utilisateur peut le modifier).
 * La page les pose à son montage et les retire à son démontage ; le layout les passe à l'en-tête.
 */
export const pageHeader = $state<{ content: Snippet | null; settings: (() => void) | null }>({
  content: null,
  settings: null,
});
