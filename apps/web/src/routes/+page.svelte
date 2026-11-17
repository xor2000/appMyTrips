<script lang="ts">
  import type { TripSummary } from '@mytrips/core';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { createTrip, deleteTrip, listTrips, searchCovers, updateTrip } from '#lib/api.ts';
  import { autoCovers } from '#lib/covers.ts';
  import { plural, todayIso } from '#lib/format.ts';
  import { groupTrips, normalizeTripSummary } from '#lib/home.ts';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import NextTrip from '#lib/components/NextTrip.svelte';
  import TripCard from '#lib/components/TripCard.svelte';
  import TripFormDialog, { type TripFormValues } from '#lib/components/TripFormDialog.svelte';
  import InstallPrompt from '#lib/components/offline/InstallPrompt.svelte';
  import OfflineBanner from '#lib/components/offline/OfflineBanner.svelte';
  import { connection } from '#lib/offline/connection.svelte.ts';
  import { offlineStore } from '#lib/offline/instance.ts';
  import { loadWithFallback } from '#lib/offline/load.ts';

  let trips = $state<TripSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let creating = $state(false);
  let toDelete = $state<TripSummary | null>(null);
  /** Date de la copie affichée hors ligne (null : données fraîches). */
  let savedAt = $state<string | null>(null);
  let prepared = $state<Set<string>>(new Set());
  const online = $derived(connection.online);
  const today = todayIso();
  const groups = $derived(groupTrips(trips, today));
  const summary = $derived(
    [
      groups.next || groups.upcoming.length > 0
        ? plural((groups.next ? 1 : 0) + groups.upcoming.length, 'voyage') + ' en vue'
        : null,
      groups.past.length > 0 ? plural(groups.past.length, 'souvenir') : null,
    ]
      .filter(Boolean)
      .join(', '),
  );

  /** Photo automatique des voyages qui n'en ont pas (voir lib/covers.ts), en ligne seulement. */
  async function fillCovers() {
    if (!connection.online) return;
    await autoCovers(trips, {
      search: (query) => searchCovers(query),
      save: async (trip, cover) => {
        const snapshot = await updateTrip(trip.id, trip.version, { cover });
        trips = trips.map((t) =>
          t.id === trip.id
            ? { ...t, cover: snapshot.trip.cover, version: snapshot.trip.version }
            : t,
        );
      },
    });
  }

  async function load() {
    try {
      const result = await loadWithFallback({
        online: connection.online,
        fetch: () => listTrips(),
        readCopy: () => offlineStore.loadTripList<TripSummary[]>(),
        writeCopy: (data) => offlineStore.saveTripList(data),
        onNetworkError: () => connection.markOffline(),
      });
      trips = result.data.map(normalizeTripSummary);
      savedAt = result.savedAt;
      prepared = new Set(await offlineStore.listPrepared().catch(() => []));
      error = null;
      if (!savedAt) fillCovers();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
    // Au retour du réseau : données fraîches.
    return connection.onReconnect(() => load());
  });

  async function create(values: TripFormValues) {
    const snapshot = await createTrip(values);
    creating = false;
    await goto(resolve('/trips/[id]', { id: snapshot.trip.id }));
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteTrip(toDelete.id);
    toDelete = null;
    await load();
  }
</script>

<svelte:head>
  <title>Mes voyages · MyTrips</title>
</svelte:head>

<div class="page">
  <section class="hero">
    <div>
      <h1>Mes voyages</h1>
      <p>{summary || 'Jours, étapes, trajets et carte : ton carnet de route, organisé.'}</p>
    </div>
    <div class="hero-actions">
      <InstallPrompt />
      {#if online}
        <button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
          Nouveau voyage
        </button>
      {/if}
    </div>
  </section>

  {#if !online}
    <OfflineBanner {savedAt} />
  {/if}

  {#if loading}
    <p class="muted">Chargement…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if trips.length === 0}
    <div class="empty">
      <h2>Aucun voyage pour l’instant</h2>
      <p>
        Crée ton premier voyage : choisis un nom et une période, puis ajoute tes étapes jour par
        jour.
      </p>
      {#if online}
        <button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
          Créer un voyage
        </button>
      {/if}
    </div>
  {:else}
    {#if groups.next}
      <NextTrip
        trip={groups.next}
        {today}
        onDelete={(t) => (toDelete = t)}
        offlineReady={prepared.has(groups.next.id)}
        readOnly={!online}
      />
    {/if}
    {#if groups.upcoming.length > 0}
      <section class="group" aria-labelledby="upcoming-title">
        <h2 id="upcoming-title">En cours et à venir</h2>
        <div class="grid">
          {#each groups.upcoming as trip (trip.id)}
            <TripCard
              {trip}
              {today}
              onDelete={(t) => (toDelete = t)}
              offlineReady={prepared.has(trip.id)}
              readOnly={!online}
            />
          {/each}
        </div>
      </section>
    {/if}
    {#if groups.past.length > 0}
      <section class="group" aria-labelledby="past-title">
        <h2 id="past-title">Souvenirs</h2>
        <div class="grid">
          {#each groups.past as trip (trip.id)}
            <TripCard
              {trip}
              {today}
              onDelete={(t) => (toDelete = t)}
              offlineReady={prepared.has(trip.id)}
              readOnly={!online}
            />
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

{#if creating}
  <TripFormDialog onSubmit={create} onClose={() => (creating = false)} />
{/if}

{#if toDelete}
  <ConfirmDialog
    title="Supprimer le voyage ?"
    message={`« ${toDelete.name} » et tous ses jours seront supprimés. Cette action est définitive.`}
    confirmLabel="Supprimer définitivement"
    onConfirm={confirmDelete}
    onCancel={() => (toDelete = null)}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }

  .hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  h1 {
    font-size: 34px;
    font-weight: 800;
  }

  .hero p,
  .muted,
  .empty p {
    margin: var(--space-1) 0 0;
    color: var(--muted);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .group h2 {
    font-size: 18px;
    font-weight: 700;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-8);
    border: 2px dashed var(--line);
    border-radius: var(--radius-lg);
  }

  .empty p {
    max-width: 52ch;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
</style>
