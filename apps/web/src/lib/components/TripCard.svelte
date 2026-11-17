<script lang="ts">
  import type { TripSummary } from '@mytrips/core';
  import { resolve } from '$app/paths';
  import {
    countdownLabel,
    formatDistance,
    formatPeriod,
    plural,
    tripDayNumber,
    tripPhase,
  } from '#lib/format.ts';
  import { tripTint } from '#lib/trips/tint.ts';

  interface Props {
    trip: TripSummary;
    /** Date du jour (AAAA-MM-JJ), pour le compte à rebours. */
    today: string;
    onDelete: (trip: TripSummary) => void;
    /** Voyage préparé pour la consultation hors ligne. */
    offlineReady?: boolean;
    /** Hors ligne : pas de suppression. */
    readOnly?: boolean;
  }

  let { trip, today, onDelete, offlineReady = false, readOnly = false }: Props = $props();

  const phase = $derived(tripPhase(trip.startDate, trip.endDate, today));
  const status = $derived(
    phase === 'ongoing'
      ? `En cours · jour ${tripDayNumber(trip.startDate, today)}`
      : countdownLabel(trip.startDate, trip.endDate, today),
  );
  const shared = $derived(
    trip.role === 'owner'
      ? null
      : trip.role === 'editor'
        ? 'Partagé · modification'
        : 'Partagé · lecture',
  );
</script>

<article
  class="card"
  class:past={phase === 'past'}
  data-testid="trip-card"
  style={`--tint: var(${tripTint(trip.id)})`}
>
  <div class="cover" class:photo={trip.cover !== null}>
    {#if trip.cover}
      <!-- Décorative : le nom du voyage est dans le titre, le crédit sous la carte. -->
      <img
        src={trip.cover.thumbUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onerror={(e) => ((e.currentTarget as HTMLImageElement).hidden = true)}
      />
    {/if}
    <div class="chips">
      <span class="chip status" class:now={phase === 'ongoing'}>{status}</span>
      {#if shared}
        <span class="chip">{shared}</span>
      {/if}
      {#if offlineReady}
        <span class="chip offline">Disponible hors ligne</span>
      {/if}
    </div>
    <h2>{trip.name}</h2>
  </div>
  <div class="body">
    <p class="period">{formatPeriod(trip.startDate, trip.endDate)}</p>
    <p class="stats">
      <span>{plural(trip.dayCount, 'jour')}</span>
      {#if trip.stepCount > 0}<span>{plural(trip.stepCount, 'étape')}</span>{/if}
      {#if trip.distanceM > 0}<span>{formatDistance(trip.distanceM)}</span>{/if}
    </p>
    {#if trip.places.length > 0}
      <ul class="places" aria-label="Principaux lieux">
        {#each trip.places as place, i (i)}
          <li>{place}</li>
        {/each}
      </ul>
    {/if}
    {#if trip.cover}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- lien externe (crédit Commons) -->
      <a class="credit" href={trip.cover.sourceUrl} target="_blank" rel="noopener noreferrer"
        >Photo : {trip.cover.author} · {trip.cover.license}</a
      >
    {/if}
    <div class="actions">
      <a class="open" href={resolve('/trips/[id]', { id: trip.id })}>Ouvrir le carnet →</a>
      {#if trip.role === 'owner' && !readOnly}
        <button type="button" class="btn btn-ghost delete" onclick={() => onDelete(trip)}>
          Supprimer
        </button>
      {/if}
    </div>
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    border-radius: var(--card-radius);
    background: var(--surface);
    border: var(--card-edge) solid var(--line);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    transition: transform 0.18s ease-out;
  }

  .card:hover {
    transform: translateY(-3px);
  }

  /* Couverture : photo (ou teinte du voyage), voile sombre en bas, nom posé dessus. */
  .cover {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-6);
    min-height: 160px;
    padding: var(--space-3) var(--space-4) var(--space-3);
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--tint) 70%, var(--photo-ink)),
      var(--tint)
    );
    color: var(--photo-ink);
    isolation: isolate;
  }

  .cover img {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(180deg, transparent 40%, var(--photo-scrim));
  }

  .past .cover img {
    filter: saturate(0.55);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .chip {
    padding: 3px var(--space-2);
    background: var(--photo-chip);
    color: var(--photo-chip-ink);
    font-size: 11px;
  }

  .chip.status {
    background: var(--accent);
    color: var(--on-accent);
  }

  .chip.status.now {
    background: var(--ok);
    color: var(--on-type);
  }

  .past .chip.status {
    background: var(--photo-chip);
    color: var(--photo-chip-ink);
  }

  .chip.offline {
    background: var(--ok-soft);
    color: var(--ok);
  }

  h2 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 8px var(--photo-shade);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-4);
  }

  .period {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: 0;
    font: 500 12px var(--font-mono);
    color: var(--fg);
  }

  .places {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .places li {
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11.5px;
  }

  .credit {
    font-size: 11px;
    color: var(--muted);
    text-decoration: none;
  }

  .credit:hover {
    text-decoration: underline;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--space-1);
  }

  .open {
    color: var(--accent-strong);
    font-family: var(--font-display);
    font-weight: 600;
    text-decoration: none;
  }

  .open:hover {
    text-decoration: underline;
  }

  .delete {
    min-height: 30px;
    font-size: 13px;
  }
</style>
