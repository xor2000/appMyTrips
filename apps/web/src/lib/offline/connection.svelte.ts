/**
 * État de la connexion : `navigator.onLine`, événements `online` / `offline`, et échec réseau d'un
 * appel API (`markOffline`). Au retour du réseau, les rappels `onReconnect` sont appelés.
 */
export function createConnection(target: EventTarget, isOnline: () => boolean) {
  let online = $state(isOnline());
  // Rappels internes, volontairement non réactifs.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const listeners = new Set<() => void>();
  target.addEventListener('offline', () => (online = false));
  target.addEventListener('online', () => {
    online = true;
    for (const fn of listeners) fn();
  });
  return {
    get online() {
      return online;
    },
    markOffline() {
      online = false;
    },
    /** Rappel au retour du réseau ; renvoie de quoi le retirer. */
    onReconnect(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Connexion de l'application (navigateur) ; toujours « en ligne » hors navigateur. */
export const connection = createConnection(
  typeof window === 'undefined' ? new EventTarget() : window,
  () => (typeof navigator === 'undefined' ? true : navigator.onLine),
);
