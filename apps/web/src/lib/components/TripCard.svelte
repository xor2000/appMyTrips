<script lang="ts">
  import type { TripSummary } from '@mytrips/core';
  import { resolve } from '$app/paths';
  import { countdownLabel, formatPeriod, plural } from '#lib/format.ts';

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

  // Teinte stable par voyage, prise dans les couleurs des types d'étape.
  const tints = [
    '--type-poi',
    '--type-hotel',
    '--type-food',
    '--type-museum',
    '--type-hike',
    '--type-air',
  ];
  const tint = $derived(
    tints[[...trip.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % tints.length],
  );
  const shared = $derived(
    trip.role === 'owner'
      ? null
      : trip.role === 'editor'
        ? 'Partagé · modification'
        : 'Partagé · lecture',
  );
</script>

<article class="card" style={`--tint: var(${tint})`}>
  <div class="cover">
    <span class="eyebrow">{plural(trip.dayCount, 'jour')}</span>
    <h2>{trip.name}</h2>
    <span class="countdown chip">{countdownLabel(trip.startDate, trip.endDate, today)}</span>
    {#if offlineReady}
      <span class="offline chip">Disponible hors ligne</span>
    {/if}
  </div>
  <div class="body">
    <p class="period">{formatPeriod(trip.startDate, trip.endDate)}</p>
    {#if shared}
      <span class="chip shared">{shared}</span>
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
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    transition: transform 0.15s ease-out;
  }

  .card:hover {
    transform: translateY(-2px);
  }

  .cover {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-6) var(--space-6) var(--space-8);
    background: color-mix(in srgb, var(--tint) 85%, var(--on-type));
    color: var(--on-type);
  }

  .eyebrow {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.9;
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
  }

  .countdown {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    background: color-mix(in srgb, var(--on-type) 25%, transparent);
    color: var(--on-type);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: calc(-1 * var(--space-4));
    padding: var(--space-4) var(--space-6) var(--space-4);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface);
  }

  .period {
    margin: 0;
    color: var(--muted);
  }

  .shared {
    align-self: flex-start;
    background: color-mix(in srgb, var(--tint) 15%, var(--surface));
    color: var(--fg);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .offline {
    background: var(--ok-soft);
    color: var(--ok);
  }
</style>
