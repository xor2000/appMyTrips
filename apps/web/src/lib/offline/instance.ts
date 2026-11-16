import { del, get, keys, set } from 'idb-keyval';
import { createOfflineStore } from './store.ts';

/** Copies hors ligne de l'application, dans IndexedDB. */
export const offlineStore = createOfflineStore({
  get: (key) => get(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
  keys: async () => (await keys()).map(String),
});

/** Cache des tuiles du service worker (voir runtimeCaching dans vite.config.ts). */
export const TILE_CACHE = 'ofm-tiles';
