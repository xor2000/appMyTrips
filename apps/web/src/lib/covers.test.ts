import { describe, expect, it, vi } from 'vitest';
import { makeCover, makeTripSummary } from '#lib/test/fixtures.ts';
import { autoCovers, COVER_TRIED_KEY, readTriedCovers } from './covers';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('autoCovers', () => {
  it('donne la première photo trouvée aux voyages modifiables sans photo', async () => {
    const storage = memoryStorage();
    const search = vi.fn().mockResolvedValue([makeCover(), makeCover({ url: 'https://x/2.jpg' })]);
    const save = vi.fn().mockResolvedValue(undefined);
    const trips = [
      makeTripSummary({ id: 'a', name: 'Voyage test Alpes' }),
      makeTripSummary({ id: 'b', name: 'Paris', cover: makeCover() }),
      makeTripSummary({ id: 'c', name: 'Rome', role: 'viewer' }),
      makeTripSummary({ id: 'd', name: 'Lyon', role: 'editor' }),
    ];
    await autoCovers(trips, { search, save, storage });
    expect(search.mock.calls.map((c) => c[0])).toEqual(['Alpes', 'Lyon']);
    expect(save.mock.calls.map((c) => [c[0].id, c[1].url])).toEqual([
      ['a', makeCover().url],
      ['d', makeCover().url],
    ]);
  });

  it('sans photo trouvée (ou sans mot-clé), ne recherche plus sur cet appareil', async () => {
    const storage = memoryStorage();
    const search = vi.fn().mockResolvedValue([]);
    const save = vi.fn();
    const trips = [
      makeTripSummary({ id: 'a', name: 'Zzz introuvable' }),
      makeTripSummary({ id: 'b', name: 'Mon voyage' }),
    ];
    await autoCovers(trips, { search, save, storage });
    expect(search).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(readTriedCovers(storage)).toEqual(new Set(['a', 'b']));

    await autoCovers(trips, { search, save, storage });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('se sert des lieux des étapes quand le nom ne dit rien', async () => {
    const search = vi.fn().mockResolvedValue([makeCover()]);
    await autoCovers([makeTripSummary({ name: 'Vacances 2026', places: ['MuCEM'] })], {
      search,
      save: vi.fn().mockResolvedValue(undefined),
      storage: memoryStorage(),
    });
    expect(search).toHaveBeenCalledWith('MuCEM');
  });

  it('une erreur réseau n’empêche pas les autres voyages et ne marque rien', async () => {
    const storage = memoryStorage();
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValueOnce([makeCover()]);
    const save = vi.fn().mockResolvedValue(undefined);
    await autoCovers(
      [makeTripSummary({ id: 'a', name: 'Alpes' }), makeTripSummary({ id: 'b', name: 'Lyon' })],
      { search, save, storage },
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(readTriedCovers(storage)).toEqual(new Set());
  });

  it('stockage illisible ou bloqué : rien de mémorisé, sans erreur', () => {
    expect(readTriedCovers(memoryStorage({ [COVER_TRIED_KEY]: 'pas du json' }))).toEqual(new Set());
    const blocked = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
      removeItem: () => {},
    };
    expect(readTriedCovers(blocked)).toEqual(new Set());
  });
});
