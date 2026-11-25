<script lang="ts">
  import {
    legColorVar,
    LEG_COLOR_COUNT,
    suggestIllustration,
    type TripSummary,
  } from '@mytrips/core';
  import Check from 'lucide-svelte/icons/check';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import Plus from 'lucide-svelte/icons/plus';
  import Settings from 'lucide-svelte/icons/settings';
  import { tick } from 'svelte';
  import { formatPeriod, todayIso } from '#lib/format.ts';
  import { groupTrips } from '#lib/home.ts';
  import Illustration from '#lib/illustrations/Illustration.svelte';

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

  const uid = $props.id();
  const listId = `${uid}-voyages`;
  const optionId = (tripId: string) => `${uid}-voyage-${tripId}`;

  const groups = $derived(groupTrips(trips, today));
  const sections = $derived(
    [
      {
        id: 'upcoming',
        label: 'En cours et à venir',
        trips: groups.next ? [groups.next, ...groups.upcoming] : groups.upcoming,
      },
      { id: 'past', label: 'Souvenirs', trips: groups.past },
    ].filter((s) => s.trips.length > 0),
  );
  /** Voyages dans l'ordre d'affichage, pour le clavier. */
  const ordered = $derived(sections.flatMap((s) => s.trips));
  const current = $derived(trips.find((t) => t.id === currentId) ?? null);

  let open = $state(false);
  /** Voyage mis en avant dans la liste ouverte (survol ou flèches). */
  let activeId = $state<string | null>(null);
  let root: HTMLElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let list: HTMLElement | undefined = $state();
  /** Illustration choisie, sinon suggérée par le nom et les lieux ; null : initiale du voyage. */
  const illustrationOf = (trip: TripSummary) =>
    trip.illustration ?? suggestIllustration(trip.name, trip.places);

  /** Couleur de l'initiale, stable pour un voyage : une des couleurs des trajets du thème. */
  function tintOf(trip: TripSummary) {
    let hash = 0;
    for (const ch of trip.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `var(${legColorVar(hash % LEG_COLOR_COUNT)})`;
  }

  const initialOf = (trip: TripSummary) => trip.name.trim().charAt(0).toUpperCase() || '?';

  async function show() {
    activeId = current?.id ?? ordered[0]?.id ?? null;
    open = true;
    await tick();
    revealActive();
  }

  /** Garde l'option mise en avant visible dans une longue liste. */
  function revealActive() {
    if (!activeId) return;
    list?.querySelector(`#${CSS.escape(optionId(activeId))}`)?.scrollIntoView?.({
      block: 'nearest',
    });
  }

  function close(refocus = false) {
    open = false;
    activeId = null;
    if (refocus) trigger?.focus();
  }

  function choose(id: string) {
    if (id !== currentId) onSelect(id);
    close(true);
  }

  function moveActive(offset: number | 'first' | 'last') {
    if (ordered.length === 0) return;
    const index = ordered.findIndex((t) => t.id === activeId);
    const next =
      offset === 'first'
        ? 0
        : offset === 'last'
          ? ordered.length - 1
          : (index + offset + ordered.length) % ordered.length;
    activeId = ordered[next]?.id ?? null;
    revealActive();
  }

  // Motif « combobox à liste seule » (WAI-ARIA) : le focus reste sur le bouton, l'option active
  // est désignée par `aria-activedescendant`.
  function onKeydown(event: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        void show();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        moveActive(1);
        break;
      case 'ArrowUp':
        moveActive(-1);
        break;
      case 'Home':
        moveActive('first');
        break;
      case 'End':
        moveActive('last');
        break;
      case 'Enter':
      case ' ':
        if (activeId) choose(activeId);
        break;
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close();
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  /** Un clic ou un toucher hors de la liste la ferme. */
  function onWindowPointerdown(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) close();
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} />

{#snippet thumb(trip: TripSummary | null, size: 'sm' | 'md')}
  {@const illustration = trip ? illustrationOf(trip) : null}
  <span
    class="thumb {size}"
    style={trip && !illustration ? `--tint: ${tintOf(trip)}` : undefined}
    aria-hidden="true"
  >
    {#if illustration}
      <Illustration id={illustration} variant="picto" decorative />
    {:else if trip}
      {initialOf(trip)}
    {/if}
  </span>
{/snippet}

<!-- Choix du voyage façon maquette de référence : liste, roue crantée et « + » dans une pilule. -->
{#if trips.length > 0 || onSettings || onCreate}
  <div class="trip-control">
    {#if trips.length > 0}
      <div class="switcher" bind:this={root}>
        <button
          type="button"
          class="trigger"
          role="combobox"
          aria-label="Choisir un voyage"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeId ? optionId(activeId) : undefined}
          bind:this={trigger}
          onclick={() => (open ? close() : void show())}
          onkeydown={onKeydown}
        >
          {#if current}
            {@render thumb(current, 'sm')}
            <span class="name">{current.name}</span>
          {:else}
            <span class="name placeholder">Choisir un voyage…</span>
          {/if}
          <span class="chevron" aria-hidden="true"><ChevronDown size={14} strokeWidth={2.5} /></span
          >
        </button>

        {#if open}
          <div class="panel" id={listId} role="listbox" aria-label="Voyages" bind:this={list}>
            {#each sections as section (section.id)}
              <div class="group" role="group" aria-labelledby={`${uid}-${section.id}`}>
                <div class="group-label" id={`${uid}-${section.id}`} role="presentation">
                  {section.label}
                </div>
                {#each section.trips as trip (trip.id)}
                  <!-- Le clavier passe par le bouton (aria-activedescendant) : pas de focus ici. -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    class="option"
                    class:active={trip.id === activeId}
                    id={optionId(trip.id)}
                    role="option"
                    tabindex="-1"
                    aria-label={trip.name}
                    aria-selected={trip.id === currentId}
                    onpointerdown={(e) => e.preventDefault()}
                    onpointerenter={() => (activeId = trip.id)}
                    onclick={() => choose(trip.id)}
                  >
                    {@render thumb(trip, 'md')}
                    <span class="text">
                      <span class="option-name">{trip.name}</span>
                      <span class="dates">{formatPeriod(trip.startDate, trip.endDate)}</span>
                    </span>
                    {#if trip.id === currentId}
                      <span class="check" aria-hidden="true"
                        ><Check size={16} strokeWidth={2.5} /></span
                      >
                    {/if}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
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

  .switcher {
    position: relative;
    display: flex;
    min-width: 0;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    max-width: 280px;
    height: 32px;
    padding: 0 8px 0 3px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--fg);
    font: 700 13.5px var(--font-display);
    cursor: pointer;
    transition: background-color 120ms ease-out;
  }

  .trigger:has(.placeholder) {
    padding-left: 10px;
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    background: var(--surface-2);
  }

  .trigger:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .placeholder {
    color: var(--muted);
  }

  .chevron {
    display: flex;
    flex: none;
    color: var(--muted);
    transition: transform 160ms ease-out;
  }

  .trigger[aria-expanded='true'] .chevron {
    transform: rotate(180deg);
  }

  /* Vignette : pictogramme de l'illustration, sinon initiale sur une couleur du thème. */
  .thumb {
    display: grid;
    flex: none;
    place-items: center;
    overflow: hidden;
    background: color-mix(in srgb, var(--tint, var(--accent)) 22%, var(--surface));
    color: color-mix(in srgb, var(--tint, var(--accent)) 70%, var(--fg));
    font-family: var(--font-display);
    font-weight: 800;
  }

  .thumb.sm {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    font-size: 12px;
  }

  .thumb.md {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    font-size: 17px;
  }

  .panel {
    position: absolute;
    top: calc(100% + 8px);
    left: -4px;
    z-index: 30;
    width: 320px;
    max-height: min(480px, calc(100vh - 90px));
    overflow-y: auto;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-window);
    transform-origin: top left;
    animation: panel-in 140ms ease-out;
  }

  @keyframes panel-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }

    .chevron,
    .trigger {
      transition: none;
    }
  }

  .group + .group {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }

  .group-label {
    padding: 8px 10px 4px;
    color: var(--muted);
    font: 800 10.5px var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 6px;
    border-radius: var(--radius-sm);
    color: var(--fg);
    cursor: pointer;
  }

  .option.active {
    background: var(--surface-2);
  }

  .option[aria-selected='true'] {
    background: var(--accent-soft);
  }

  .option[aria-selected='true'].active {
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .option-name {
    overflow: hidden;
    font: 700 13.5px var(--font-display);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option[aria-selected='true'] .option-name,
  .check {
    color: var(--accent-strong);
  }

  .dates {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }

  .check {
    display: flex;
    flex: none;
    padding-right: 4px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 9px;
  }
</style>
