import type { TripSummary } from '@mytrips/core';
import { listTrips } from '#lib/api.ts';
import { normalizeTripSummary } from '#lib/home.ts';
import { connection } from '#lib/offline/connection.svelte.ts';
import { offlineStore } from '#lib/offline/instance.ts';
import { loadWithFallback } from '#lib/offline/load.ts';

/**
 * Liste des voyages de l'utilisateur, partagée par l'en-tête (liste déroulante) et par « / »
 * (choix du voyage à ouvrir). Chargée par le layout, tenue à jour par la page voyage (nom,
 * dates) et par la création ou la suppression d'un voyage.
 */
export const tripList = $state<{
  trips: TripSummary[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Date de la copie hors ligne affichée (null : données fraîches). */
  savedAt: string | null;
  error: string | null;
  /** Fenêtre « Nouveau voyage » ouverte (bouton « + » de l'en-tête ou écran sans voyage). */
  creating: boolean;
}>({ trips: [], status: 'idle', savedAt: null, error: null, creating: false });

type Loader = () => Promise<{ data: TripSummary[]; savedAt: string | null }>;

/** Liste en ligne, ou sa copie hors ligne (IndexedDB) sans réseau. */
const loadOnlineOrCopy: Loader = () =>
  loadWithFallback({
    online: connection.online,
    fetch: () => listTrips(),
    readCopy: () => offlineStore.loadTripList<TripSummary[]>(),
    writeCopy: (data) => offlineStore.saveTripList(data),
    onNetworkError: () => connection.markOffline(),
  });

let request = 0;

/** (Re)charge la liste ; un chargement plus ancien terminé après un plus récent est ignoré. */
export async function refreshTripList(load: Loader = loadOnlineOrCopy): Promise<void> {
  const current = ++request;
  if (tripList.status !== 'ready') tripList.status = 'loading';
  try {
    const result = await load();
    if (current !== request) return;
    tripList.trips = result.data.map(normalizeTripSummary);
    tripList.savedAt = result.savedAt;
    tripList.error = null;
    tripList.status = 'ready';
  } catch (e) {
    if (current !== request) return;
    tripList.error = e instanceof Error ? e.message : String(e);
    tripList.status = 'error';
  }
}

/** Ajoute un voyage à la liste, ou remplace celui qui a le même identifiant. */
export function upsertTrip(summary: TripSummary) {
  const trip = normalizeTripSummary(summary);
  const index = tripList.trips.findIndex((t) => t.id === trip.id);
  if (index === -1) tripList.trips = [...tripList.trips, trip];
  else tripList.trips = tripList.trips.map((t, i) => (i === index ? trip : t));
}

export function removeTrip(id: string) {
  tripList.trips = tripList.trips.filter((t) => t.id !== id);
}

/** Vide la liste (déconnexion : elle appartient au compte). */
export function resetTripList() {
  request++;
  tripList.trips = [];
  tripList.status = 'idle';
  tripList.savedAt = null;
  tripList.error = null;
  tripList.creating = false;
}
