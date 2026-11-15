<script lang="ts">
  import type { Day } from '@mytrips/core';
  import { dayTabLabel } from '#lib/format.ts';

  interface Props {
    days: Day[];
    /** Jour sélectionné, ou null pour « Tout le voyage ». */
    selected: string | null;
    onSelect: (dayId: string | null) => void;
  }

  let { days, selected, onSelect }: Props = $props();
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
      aria-selected={selected === day.id}
      onclick={() => onSelect(day.id)}
    >
      <b>J{i + 1}</b>
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

  .tab[aria-selected='true'] {
    background: var(--accent);
    color: var(--on-accent);
  }

  .tab[aria-selected='true'] b {
    color: var(--on-accent);
  }
</style>
