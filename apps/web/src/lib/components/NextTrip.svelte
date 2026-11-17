<script lang="ts">
  import { toDayNumber, type TripSummary } from '@mytrips/core';
  import { resolve } from '$app/paths';
  import { formatDistance, formatPeriod, plural, tripDayNumber, tripPhase } from '#lib/format.ts';
  import { tripTint } from '#lib/trips/tint.ts';

  interface Props {
    /** Voyage en cours ou prochain départ. */
    trip: TripSummary;
    /** Date du jour (AAAA-MM-JJ). */
    today: string;
    onDelete: (trip: TripSummary) => void;
    offlineReady?: boolean;
    readOnly?: boolean;
  }

  let { trip, today, onDelete, offlineReady = false, readOnly = false }: Props = $props();

  const ongoing = $derived(tripPhase(trip.startDate, trip.endDate, today) === 'ongoing');
  const daysLeft = $derived(toDayNumber(trip.startDate) - toDayNumber(today));
  const summary = $derived(
    [
      plural(trip.dayCount, 'jour'),
      trip.stepCount > 0 ? plural(trip.stepCount, 'étape') : null,
      trip.distanceM > 0 ? formatDistance(trip.distanceM) : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  const shared = $derived(
    trip.role === 'owner'
      ? null
      : trip.role === 'editor'
        ? 'Partagé · modification'
        : 'Partagé · lecture',
  );
</script>

<article class="next" data-testid="next-trip" style={`--tint: var(${tripTint(trip.id)})`}>
  {#if trip.cover}
    <img
      src={trip.cover.url}
      alt=""
      decoding="async"
      onerror={(e) => ((e.currentTarget as HTMLImageElement).hidden = true)}
    />
  {/if}
  <div class="content">
    <div class="text">
      <span class="kicker">{ongoing ? 'En cours' : 'Prochain départ'}</span>
      <h2>{trip.name}</h2>
      <p class="meta">
        <span>{formatPeriod(trip.startDate, trip.endDate)}</span>
        <span>{summary}</span>
      </p>
      {#if trip.places.length > 0}
        <ul class="places" aria-label="Principaux lieux">
          {#each trip.places as place, i (i)}
            <li>{place}</li>
          {/each}
        </ul>
      {/if}
      <div class="chips">
        {#if shared}<span class="chip">{shared}</span>{/if}
        {#if offlineReady}<span class="chip">Disponible hors ligne</span>{/if}
      </div>
    </div>
    <div class="side">
      <p class="count" data-testid="next-countdown">
        {#if ongoing}<b>J{tripDayNumber(trip.startDate, today)}</b>
          <span>sur {trip.dayCount}</span>{:else}<b>{daysLeft}</b>
          <span>{daysLeft > 1 ? 'jours' : 'jour'}</span>{/if}
      </p>
      <a class="open" href={resolve('/trips/[id]', { id: trip.id })}>Ouvrir le carnet →</a>
      {#if trip.role === 'owner' && !readOnly}
        <button type="button" class="delete" onclick={() => onDelete(trip)}>Supprimer</button>
      {/if}
    </div>
  </div>
  {#if trip.cover}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- lien externe (crédit Commons) -->
    <a class="credit" href={trip.cover.sourceUrl} target="_blank" rel="noopener noreferrer"
      >Photo : {trip.cover.author} · {trip.cover.license}</a
    >
  {/if}
</article>

<style>
  .next {
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 300px;
    border-radius: var(--radius-xl);
    overflow: hidden;
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--tint) 65%, var(--photo-ink)),
      var(--tint)
    );
    color: var(--photo-ink);
    box-shadow: var(--shadow-window);
    isolation: isolate;
  }

  img {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .next::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(180deg, transparent 30%, var(--photo-scrim));
  }

  .content {
    display: flex;
    align-items: flex-end;
    gap: var(--space-6);
    width: 100%;
    padding: var(--space-6) var(--space-6) var(--space-8);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .kicker {
    font: 600 12px var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h2 {
    font-size: clamp(28px, 4vw, 42px);
    font-weight: 800;
    letter-spacing: -0.02em;
    text-shadow: 0 1px 10px var(--photo-shade);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0;
    font-size: 14px;
  }

  .places {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .places li,
  .chip {
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--photo-glass);
    border: 1px solid var(--photo-glass-edge);
    font-size: 12px;
  }

  .chips {
    display: flex;
    gap: var(--space-1);
  }

  .side {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-3);
  }

  .count {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--photo-glass);
    border: 1px solid var(--photo-glass-edge);
    backdrop-filter: blur(6px);
  }

  .count b {
    font: 800 40px/1 var(--font-display);
  }

  .count span {
    font: 600 11px var(--font-display);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .open {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--btn-radius);
    background: var(--surface);
    color: var(--fg);
    font: 600 14px var(--font-display);
    text-decoration: none;
    white-space: nowrap;
  }

  .open:hover {
    background: var(--surface-2);
  }

  .delete {
    border: 0;
    background: transparent;
    color: var(--photo-ink);
    font: 600 12px var(--font-display);
    opacity: 0.8;
    cursor: pointer;
  }

  .delete:hover {
    opacity: 1;
    text-decoration: underline;
  }

  .credit {
    position: absolute;
    right: var(--space-3);
    bottom: var(--space-2);
    color: var(--photo-ink);
    font-size: 10.5px;
    opacity: 0.8;
    text-decoration: none;
  }

  .credit:hover {
    opacity: 1;
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .content {
      flex-direction: column;
      align-items: stretch;
    }

    .side {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
</style>
