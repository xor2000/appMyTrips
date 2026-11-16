/** Accès clé-valeur (IndexedDB via idb-keyval en production, mémoire dans les tests). */
export interface KeyValue {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** Copie hors ligne : données et date de la copie (ISO). */
export interface OfflineCopy<T> {
  data: T;
  savedAt: string;
}

/** Voyage préparé hors ligne : tuiles préchargées et espace estimé. */
export interface PreparedTrip {
  at: string;
  bytes: number;
  tileUrls: string[];
}

const TRIP = 'trip:';
const PREPARED = 'prepared:';
const TRIP_LIST = 'trips';

/**
 * Copies hors ligne des données : liste des voyages, instantané de chaque voyage ouvert, voyages
 * préparés (tuiles). Mises à jour à chaque chargement réussi.
 */
export function createOfflineStore(kv: KeyValue, now: () => Date = () => new Date()) {
  const save = (key: string, data: unknown) =>
    kv.set(key, { data, savedAt: now().toISOString() } satisfies OfflineCopy<unknown>);
  const load = async <T>(key: string) =>
    ((await kv.get(key)) as OfflineCopy<T> | undefined) ?? null;

  return {
    saveTrip: (id: string, snapshot: unknown) => save(TRIP + id, snapshot),
    loadTrip: <T>(id: string) => load<T>(TRIP + id),
    saveTripList: (trips: unknown) => save(TRIP_LIST, trips),
    loadTripList: <T>() => load<T>(TRIP_LIST),
    /** Ajoute (ou remplace) un voyage dans la copie de la liste : voyage ouvert après la liste. */
    async upsertTripInList<T extends { id: string }>(trip: T) {
      const list = ((await load<T[]>(TRIP_LIST))?.data ?? []).filter(Boolean);
      const index = list.findIndex((t) => t.id === trip.id);
      if (index >= 0) list[index] = trip;
      else list.push(trip);
      await save(TRIP_LIST, list);
    },

    markPrepared: (id: string, value: { tileUrls: string[]; bytes: number }) =>
      kv.set(PREPARED + id, { ...value, at: now().toISOString() } satisfies PreparedTrip),
    getPrepared: async (id: string) =>
      ((await kv.get(PREPARED + id)) as PreparedTrip | undefined) ?? null,
    listPrepared: async () =>
      (await kv.keys()).filter((k) => k.startsWith(PREPARED)).map((k) => k.slice(PREPARED.length)),

    /** Oublie un voyage préparé ; renvoie les tuiles qu'aucun autre voyage préparé n'utilise. */
    async removePrepared(id: string): Promise<string[]> {
      const target = (await kv.get(PREPARED + id)) as PreparedTrip | undefined;
      await kv.del(PREPARED + id);
      if (!target) return [];
      const others = new Set<string>();
      for (const key of await kv.keys()) {
        if (!key.startsWith(PREPARED)) continue;
        for (const url of ((await kv.get(key)) as PreparedTrip).tileUrls) others.add(url);
      }
      return target.tileUrls.filter((url) => !others.has(url));
    },
  };
}

export type OfflineStore = ReturnType<typeof createOfflineStore>;
