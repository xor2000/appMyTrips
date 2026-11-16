<script lang="ts">
  import type { Day } from '@mytrips/core';
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
  }

  let { days, selected, onSelect, onDropStep, alerts = new Set() }: Props = $props();

  let over = $state<string | null>(null);

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
    onclick={() => onSelect(null)}>Tout le voyage</button
  >
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

<style>
  .tabs {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .tab {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: var(--space-1) var(--space-3);
    border: 0;
    border-radius: var(--radius-pill);
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

  .tab.all {
    justify-content: center;
    font-weight: 600;
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

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
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
