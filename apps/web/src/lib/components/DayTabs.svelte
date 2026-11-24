<script lang="ts">
  import type { Day } from '@mytrips/core';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import { dayTabLabel } from '#lib/format.ts';
  import { drag } from '#lib/steps/dnd.svelte.ts';

  interface Props {
    days: Day[];
    /** Jour sélectionné, ou null pour « Tout le voyage ». */
    selected: string | null;
    onSelect: (dayId: string | null) => void;
    /** Dépôt d'une étape glissée sur l'onglet d'un jour (fin de ce jour). */
    onDropStep?: (stepId: string, dayId: string) => void;
    /** Jours en conflit ou qui débordent (pastille d'alerte). */
    alerts?: Set<string>;
    /** Période du voyage, affichée sous « Tout le voyage ». */
    period?: string;
  }

  let { days, selected, onSelect, onDropStep, alerts = new Set(), period }: Props = $props();

  let over = $state<string | null>(null);

  // Défilement des jours : barre masquée, flèches avant le premier et après le dernier jour quand
  // ils ne tiennent pas sur la ligne de l'en-tête.
  let scroller = $state<HTMLDivElement>();
  let overflow = $state(false);
  let atStart = $state(true);
  let atEnd = $state(true);

  function measure() {
    if (!scroller) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    overflow = scrollWidth - clientWidth > 1;
    atStart = scrollLeft <= 1;
    atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
  }

  /** Avance (1) ou recule (-1) d'environ une largeur visible de jours. */
  function scrollPage(direction: 1 | -1) {
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: 'smooth' });
  }

  /** Une étape glissée sur une flèche fait défiler, pour atteindre un jour masqué. */
  function onArrowDragOver(event: DragEvent, direction: 1 | -1) {
    if (!onDropStep || !drag.stepId || !scroller) return;
    event.preventDefault();
    scroller.scrollBy({ left: direction * 16 });
    measure();
  }

  // Mesure au montage, quand les jours changent et quand la place disponible change.
  $effect(() => {
    void days.length;
    measure();
  });

  $effect(() => {
    const el = scroller;
    if (!el) return;
    // Molette verticale : défilement horizontal des jours (non passif pour l'empêcher de faire
    // défiler la page).
    const onWheel = (event: WheelEvent) => {
      if (!overflow || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      // Delta en lignes (Firefox, `deltaMode` 1) : environ 16 px par ligne.
      el.scrollBy({ left: event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY });
      measure();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      observer?.disconnect();
    };
  });

  function onDragOver(event: DragEvent, dayId: string) {
    if (!onDropStep || !drag.stepId) return;
    event.preventDefault();
    over = dayId;
  }

  function onDrop(event: DragEvent, dayId: string) {
    if (!onDropStep || !drag.stepId) return;
    event.preventDefault();
    over = null;
    onDropStep(drag.stepId, dayId);
  }
</script>

<div class="tabs" role="tablist" aria-label="Jours du voyage">
  <button
    type="button"
    role="tab"
    class="tab all"
    aria-selected={selected === null}
    onclick={() => onSelect(null)}
    ><b>Tout le voyage</b>{#if period}<span>{period}</span>{/if}</button
  >
  <!-- Flèches : aide à la souris, hors de l'arbre d'accessibilité (au clavier, l'onglet qui
       reçoit le focus défile de lui-même). -->
  {#if overflow}
    <button
      type="button"
      class="arrow"
      title="Jours précédents"
      aria-hidden="true"
      tabindex="-1"
      disabled={atStart}
      onclick={() => scrollPage(-1)}
      ondragover={(e) => onArrowDragOver(e, -1)}><ChevronLeft size={16} /></button
    >
  {/if}
  <div class="scroller" bind:this={scroller} onscroll={measure}>
    {#each days as day, i (day.id)}
      <button
        type="button"
        role="tab"
        class="tab"
        class:over={over === day.id}
        aria-selected={selected === day.id}
        onclick={() => onSelect(day.id)}
        ondragover={(e) => onDragOver(e, day.id)}
        ondragleave={() => (over = null)}
        ondrop={(e) => onDrop(e, day.id)}
      >
        <b
          >J{i + 1}{#if alerts.has(day.id)}<span class="alert" aria-hidden="true"></span><span
              class="visually-hidden"
            >
              · à revoir</span
            >{/if}</b
        >
        <span>{dayTabLabel(day.date)}</span>
      </button>
    {/each}
  </div>
  {#if overflow}
    <button
      type="button"
      class="arrow"
      title="Jours suivants"
      aria-hidden="true"
      tabindex="-1"
      disabled={atEnd}
      onclick={() => scrollPage(1)}
      ondragover={(e) => onArrowDragOver(e, 1)}><ChevronRight size={16} /></button
    >
  {/if}
</div>

<style>
  /* Sur la ligne de l'en-tête : « Tout le voyage » fixe, puis les jours, qui défilent sans barre
     (flèches) quand ils ne tiennent pas. */
  .tabs {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .scroller {
    display: flex;
    gap: 6px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .scroller::-webkit-scrollbar {
    display: none;
  }

  .arrow {
    flex: none;
    display: grid;
    place-items: center;
    width: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--tab-radius);
    background: transparent;
    color: var(--fg);
    cursor: pointer;
  }

  .arrow:hover:not(:disabled) {
    background: var(--surface-2);
  }

  .arrow:disabled {
    color: var(--muted);
    opacity: 0.4;
    cursor: default;
  }

  .tab {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 3px 10px;
    border: 0;
    border-radius: var(--tab-radius);
    background: var(--surface-2);
    color: var(--muted);
    font-family: var(--font-display);
    font-size: 12px;
    line-height: 1.25;
    cursor: pointer;
  }

  .tab b {
    font-size: 13px;
    color: var(--fg);
  }

  .alert {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-left: 4px;
    border-radius: 50%;
    background: var(--bad);
    vertical-align: middle;
  }

  .tab.over {
    outline: 2px dashed var(--accent);
    background: var(--accent-soft);
  }

  .tab[aria-selected='true'] {
    background: var(--accent);
    color: var(--on-accent);
  }

  .tab[aria-selected='true'] b {
    color: var(--on-accent);
  }
</style>
