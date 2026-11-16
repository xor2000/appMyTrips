import type { OfflineCopy } from './store.ts';

/** Hors ligne, et aucune copie de ces données sur cet appareil. */
export class OfflineUnavailableError extends Error {
  constructor() {
    super('Hors ligne : ces données n’ont pas encore été consultées sur cet appareil.');
    this.name = 'OfflineUnavailableError';
  }
}

/** Échec réseau d'un `fetch` (et non une réponse d'erreur de l'API). */
export const isNetworkError = (e: unknown) => e instanceof TypeError;

/**
 * Charge des données en ligne et en garde une copie ; hors ligne (ou sur échec réseau), renvoie la
 * copie avec sa date. `savedAt` vaut null pour des données fraîches. Une erreur de l'API (404,
 * 403…) n'est jamais masquée par la copie.
 */
export async function loadWithFallback<T>(options: {
  online: boolean;
  fetch: () => Promise<T>;
  readCopy: () => Promise<OfflineCopy<T> | null>;
  writeCopy: (data: T) => Promise<void>;
  onNetworkError?: () => void;
}): Promise<{ data: T; savedAt: string | null }> {
  if (options.online) {
    try {
      const data = await options.fetch();
      // Une copie qui échoue (quota, navigation privée) ne doit pas empêcher l'affichage.
      await options.writeCopy(data).catch(() => undefined);
      return { data, savedAt: null };
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      options.onNetworkError?.();
    }
  }
  const copy = await options.readCopy().catch(() => null);
  if (!copy) throw new OfflineUnavailableError();
  return copy;
}
