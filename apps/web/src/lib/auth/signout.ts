import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { logout } from '#lib/api.ts';
import { clearOfflineData } from '#lib/offline/instance.ts';
import { resetTripList } from '#lib/trips/tripList.svelte.ts';
import { session } from './session.svelte.ts';

/**
 * Déconnexion (menu du profil et page « Mon compte ») : ferme la session, efface les copies hors
 * ligne de l'appareil et la liste des voyages de l'en-tête (elles appartiennent au compte), puis
 * renvoie vers la connexion.
 * Lève une erreur si la session n'a pas pu être fermée.
 */
export async function signOut() {
  await logout();
  await clearOfflineData().catch(() => undefined);
  session.me = null;
  resetTripList();
  await goto(resolve('/connexion'), { replaceState: true });
}
