import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '#lib/api.ts';
import { createConnection } from './connection.svelte.ts';
import { OfflineUnavailableError, loadWithFallback } from './load.ts';
import { createOfflineStore, type KeyValue } from './store.ts';

/** Stockage clé-valeur en mémoire (IndexedDB en production). */
function memoryKv(): KeyValue {
  const map = new Map<string, unknown>();
  return {
    get: async (k) => map.get(k),
    set: async (k, v) => void map.set(k, structuredClone(v)),
    del: async (k) => void map.delete(k),
    keys: async () => [...map.keys()],
  };
}

describe('magasin hors ligne', () => {
  it('garde la copie d’un voyage avec sa date', async () => {
    const store = createOfflineStore(memoryKv(), () => new Date('2026-07-12T07:14:00Z'));
    await store.saveTrip('t1', { trip: { id: 't1' } });
    expect(await store.loadTrip('t1')).toEqual({
      data: { trip: { id: 't1' } },
      savedAt: '2026-07-12T07:14:00.000Z',
    });
    expect(await store.loadTrip('inconnu')).toBeNull();
  });

  it('garde la liste des voyages', async () => {
    const store = createOfflineStore(memoryKv());
    await store.saveTripList([{ id: 't1' }]);
    expect((await store.loadTripList())?.data).toEqual([{ id: 't1' }]);
  });

  it('ajoute ou remplace un voyage dans la copie de la liste (voyage ouvert après la liste)', async () => {
    const store = createOfflineStore(memoryKv());
    await store.upsertTripInList({ id: 't1', name: 'Alpes' });
    await store.saveTripList([{ id: 't0', name: 'Ancien' }]);
    await store.upsertTripInList({ id: 't1', name: 'Alpes' });
    await store.upsertTripInList({ id: 't0', name: 'Renommé' });
    expect((await store.loadTripList())?.data).toEqual([
      { id: 't0', name: 'Renommé' },
      { id: 't1', name: 'Alpes' },
    ]);
  });

  it('voyages préparés hors ligne ; libérer ne retire que les tuiles propres au voyage', async () => {
    const store = createOfflineStore(memoryKv());
    await store.markPrepared('t1', { tileUrls: ['a', 'b'], bytes: 50_000 });
    await store.markPrepared('t2', { tileUrls: ['b', 'c'], bytes: 50_000 });
    expect((await store.listPrepared()).sort()).toEqual(['t1', 't2']);
    expect(await store.getPrepared('t1')).toMatchObject({ bytes: 50_000 });
    expect(await store.removePrepared('t1')).toEqual(['a']);
    expect(await store.listPrepared()).toEqual(['t2']);
  });
});

describe('chargement avec repli hors ligne', () => {
  const copy = { data: { id: 't1' }, savedAt: '2026-07-12T07:14:00.000Z' };

  it('en ligne : données fraîches, copie mise à jour', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await loadWithFallback({
      online: true,
      fetch: async () => ({ id: 't1', v: 2 }),
      readCopy: async () => copy,
      writeCopy: write,
    });
    expect(result).toEqual({ data: { id: 't1', v: 2 }, savedAt: null });
    expect(write).toHaveBeenCalledWith({ id: 't1', v: 2 });
  });

  it('erreur réseau : la copie, avec sa date, et la connexion passe hors ligne', async () => {
    const onNetworkError = vi.fn();
    const result = await loadWithFallback({
      online: true,
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
      readCopy: async () => copy,
      writeCopy: vi.fn(),
      onNetworkError,
    });
    expect(result).toEqual(copy);
    expect(onNetworkError).toHaveBeenCalled();
  });

  it('hors ligne : pas d’appel réseau, la copie directement', async () => {
    const fetch = vi.fn();
    expect(
      await loadWithFallback({
        online: false,
        fetch,
        readCopy: async () => copy,
        writeCopy: vi.fn(),
      }),
    ).toEqual(copy);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('hors ligne sans copie : message clair', async () => {
    await expect(
      loadWithFallback({
        online: false,
        fetch: vi.fn(),
        readCopy: async () => null,
        writeCopy: vi.fn(),
      }),
    ).rejects.toThrow(OfflineUnavailableError);
  });

  it('erreur de l’API (404, 403…) : pas de repli', async () => {
    await expect(
      loadWithFallback({
        online: true,
        fetch: async () => {
          throw new ApiError(404, 'not_found', {});
        },
        readCopy: async () => copy,
        writeCopy: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('état de la connexion', () => {
  it('suit navigator.onLine et les événements online / offline', () => {
    const target = new EventTarget();
    const connection = createConnection(target, () => true);
    expect(connection.online).toBe(true);
    target.dispatchEvent(new Event('offline'));
    expect(connection.online).toBe(false);
    const onBack = vi.fn();
    connection.onReconnect(onBack);
    target.dispatchEvent(new Event('online'));
    expect(connection.online).toBe(true);
    expect(onBack).toHaveBeenCalled();
  });

  it('un échec réseau d’un appel API bascule hors ligne', () => {
    const connection = createConnection(new EventTarget(), () => true);
    connection.markOffline();
    expect(connection.online).toBe(false);
  });
});
