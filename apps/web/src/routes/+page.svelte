<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { todayIso } from '#lib/format.ts';
  import { pickStartTrip, readLastTrip } from '#lib/home.ts';
  import OfflineBanner from '#lib/components/offline/OfflineBanner.svelte';
  import { connection } from '#lib/offline/connection.svelte.ts';
  import { tripList } from '#lib/trips/tripList.svelte.ts';

  // Plus de page d'accueil : « / » ouvre le dernier voyage consulté (voir pickStartTrip). Les
  // voyages se choisissent dans la liste déroulante de l'en-tête.
  const start = $derived(
    tripList.status === 'ready' ? pickStartTrip(tripList.trips, readLastTrip(), todayIso()) : null,
  );
  let redirected = false;

  $effect(() => {
    if (!start || redirected) return;
    redirected = true;
    goto(resolve('/trips/[id]', { id: start.id }), { replaceState: true });
  });
</script>

<svelte:head>
  <title>MyTrips</title>
</svelte:head>

<div class="page">
  {#if tripList.status === 'error'}
    <p class="form-error" role="alert">{tripList.error}</p>
  {:else if tripList.status === 'ready' && !start}
    {#if !connection.online}
      <OfflineBanner savedAt={tripList.savedAt} />
    {/if}
    <div class="empty">
      <h1>Aucun voyage pour l’instant</h1>
      <p>
        Crée ton premier voyage : choisis un nom et une période, puis ajoute tes étapes jour par
        jour.
      </p>
      {#if connection.online}
        <button type="button" class="btn btn-primary" onclick={() => (tripList.creating = true)}>
          Créer un voyage
        </button>
      {/if}
    </div>
  {:else}
    <p class="muted">Ouverture du voyage…</p>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
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

  h1 {
    font-size: 22px;
    font-weight: 800;
  }

  .empty p,
  .muted {
    max-width: 52ch;
    margin: 0;
    color: var(--muted);
  }
</style>
