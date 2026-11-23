<script lang="ts">
  import type { TripSummary } from '@mytrips/core';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import Plus from 'lucide-svelte/icons/plus';
  import Settings from 'lucide-svelte/icons/settings';
  import { todayIso } from '#lib/format.ts';
  import { groupTrips } from '#lib/home.ts';

  interface Props {
    trips: TripSummary[];
    /** Voyage ouvert ; null hors d'un voyage (Mon compte, administration). */
    currentId: string | null;
    /** Date du jour (AAAA-MM-JJ), pour ranger les voyages. */
    today?: string;
    onSelect: (id: string) => void;
    /** Paramètres du voyage ouvert ; absent : pas de roue crantée (lecteur, hors ligne). */
    onSettings?: () => void;
    /** Nouveau voyage ; absent : pas de « + » (hors ligne). */
    onCreate?: () => void;
  }

  let { trips, currentId, today = todayIso(), onSelect, onSettings, onCreate }: Props = $props();

  const groups = $derived(groupTrips(trips, today));
  const upcoming = $derived(groups.next ? [groups.next, ...groups.upcoming] : groups.upcoming);
  const known = $derived(currentId !== null && trips.some((t) => t.id === currentId));
</script>

<!-- Choix du voyage façon maquette de référence : liste, roue crantée et « + » dans une pilule. -->
{#if trips.length > 0 || onSettings || onCreate}
  <div class="trip-control">
    {#if trips.length > 0}
      <div class="select">
        <select
          aria-label="Choisir un voyage"
          value={known ? currentId : ''}
          onchange={(e) => {
            const id = e.currentTarget.value;
            if (id && id !== currentId) onSelect(id);
          }}
        >
          {#if !known}
            <option value="" disabled>Choisir un voyage…</option>
          {/if}
          {#if upcoming.length > 0}
            <optgroup label="En cours et à venir">
              {#each upcoming as trip (trip.id)}
                <option value={trip.id}>{trip.name}</option>
              {/each}
            </optgroup>
          {/if}
          {#if groups.past.length > 0}
            <optgroup label="Souvenirs">
              {#each groups.past as trip (trip.id)}
                <option value={trip.id}>{trip.name}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
        <span class="chevron" aria-hidden="true"><ChevronDown size={14} strokeWidth={2.5} /></span>
      </div>
    {/if}
    {#if onSettings}
      <button
        type="button"
        class="icon-btn"
        aria-label="Paramètres du voyage"
        title="Paramètres du voyage"
        onclick={onSettings}><Settings size={18} /></button
      >
    {/if}
    {#if onCreate}
      <button
        type="button"
        class="icon-btn"
        aria-label="Nouveau voyage"
        title="Nouveau voyage"
        onclick={onCreate}><Plus size={18} /></button
      >
    {/if}
  </div>
{/if}

<style>
  .trip-control {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface-2) 50%, var(--surface));
  }

  .select {
    position: relative;
    display: flex;
    min-width: 0;
  }

  select {
    appearance: none;
    min-width: 0;
    max-width: 260px;
    height: 32px;
    padding: 0 26px 0 10px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--fg);
    font: 700 13.5px var(--font-display);
    text-overflow: ellipsis;
    cursor: pointer;
  }

  select:hover {
    background: var(--surface-2);
  }

  select:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }

  .chevron {
    position: absolute;
    top: 50%;
    right: 9px;
    display: flex;
    color: var(--muted);
    transform: translateY(-50%);
    pointer-events: none;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 9px;
  }
</style>
