import type { Me } from '@mytrips/core';

/** Utilisateur connecté (null : inconnu ou non connecté), partagé par l'en-tête et les pages. */
export const session = $state<{ me: Me | null }>({ me: null });
