/**
 * File d'exécution séquentielle : chaque action attend la fin de la précédente. Utilisée pour les
 * écritures sur un voyage, afin que chacune lise la version du voyage à jour au moment où elle part
 * (deux actions rapprochées enverraient sinon la même version, et la seconde serait refusée).
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(action: () => Promise<T>): Promise<T> {
    const result = tail.then(action);
    // La suite de la file ne dépend pas du succès de l'action.
    tail = result.catch(() => undefined);
    return result;
  };
}
