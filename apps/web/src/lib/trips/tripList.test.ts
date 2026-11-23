import { beforeEach, describe, expect, it } from 'vitest';
import { makeTripSummary } from '#lib/test/fixtures.ts';
import {
  refreshTripList,
  removeTrip,
  resetTripList,
  tripList,
  upsertTrip,
} from './tripList.svelte.ts';

const a = makeTripSummary({ id: 'a', name: 'Alpes' });
const b = makeTripSummary({ id: 'b', name: 'Bretagne' });

describe('liste des voyages de l’en-tête', () => {
  beforeEach(() => resetTripList());

  it('charge la liste (ou sa copie hors ligne) et la complète', async () => {
    const old = { ...a } as Partial<typeof a>;
    delete old.places;
    await refreshTripList(async () => ({
      data: [old as typeof a, b],
      savedAt: '2026-11-20T08:00:00Z',
    }));
    expect(tripList.status).toBe('ready');
    expect(tripList.trips.map((t) => t.name)).toEqual(['Alpes', 'Bretagne']);
    expect(tripList.trips[0]?.places).toEqual([]);
    expect(tripList.savedAt).toBe('2026-11-20T08:00:00Z');
  });

  it('garde l’erreur de chargement', async () => {
    await refreshTripList(() => Promise.reject(new Error('Serveur indisponible')));
    expect(tripList.status).toBe('error');
    expect(tripList.error).toBe('Serveur indisponible');
  });

  it('met à jour un voyage modifié, ajoute un nouveau, retire un supprimé', async () => {
    await refreshTripList(async () => ({ data: [a], savedAt: null }));
    upsertTrip({ ...a, name: 'Alpes du Sud' });
    expect(tripList.trips.map((t) => t.name)).toEqual(['Alpes du Sud']);
    upsertTrip(b);
    expect(tripList.trips.map((t) => t.id)).toEqual(['a', 'b']);
    removeTrip('a');
    expect(tripList.trips.map((t) => t.id)).toEqual(['b']);
  });

  it('un chargement plus ancien ne remplace pas un plus récent', async () => {
    let finishFirst: (v: { data: (typeof a)[]; savedAt: null }) => void = () => {};
    const first = refreshTripList(() => new Promise((resolve) => (finishFirst = resolve)));
    await refreshTripList(async () => ({ data: [b], savedAt: null }));
    finishFirst({ data: [a], savedAt: null });
    await first;
    expect(tripList.trips.map((t) => t.id)).toEqual(['b']);
  });

  it('se vide à la déconnexion', async () => {
    await refreshTripList(async () => ({ data: [a], savedAt: null }));
    tripList.creating = true;
    resetTripList();
    expect(tripList.trips).toEqual([]);
    expect(tripList.status).toBe('idle');
    expect(tripList.creating).toBe(false);
  });
});
