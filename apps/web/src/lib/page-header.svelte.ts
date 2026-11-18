import type { Snippet } from 'svelte';

/**
 * Contenu qu'une page place dans l'en-tête de l'application, sur la même ligne que le logo et
 * le profil (la page voyage y met son titre et ses actions). La page le pose à son montage et
 * le retire à son démontage ; le layout le passe à `AppHeader`.
 */
export const pageHeader = $state<{ content: Snippet | null }>({ content: null });
