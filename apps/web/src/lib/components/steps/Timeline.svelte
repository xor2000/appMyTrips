<script lang="ts">
  import type { ScheduledItem, Step, StayItem, TimelineItem } from '@mytrips/core';
  import type { Snippet } from 'svelte';
  import type { DropTarget } from '#lib/steps/dnd.svelte.ts';
  import DropZone from './DropZone.svelte';
  import GroupCard from './GroupCard.svelte';
  import StayCard from './StayCard.svelte';
  import StepCard from './StepCard.svelte';

  interface Props {
    items: TimelineItem[];
    /** Numéros de carte par clé d'étape. */
    labels: Map<string, string>;
    canEdit: boolean;
    highlighted: string | null;
    onEdit: (step: Step) => void;
    onEditStay?: (item: StayItem) => void;
    onMove: (step: Step, delta: -1 | 1) => void;
    onDelete: (step: Step) => void;
    onHover: (key: string | null) => void;
    onDrop: (stepId: string, target: DropTarget) => void;
    /** Rendu après chaque point de passage (clé d'étape ou de séjour) : tuile de trajet. */
    after?: Snippet<[string]>;
    /** Horaires calculés, par clé d'étape. */
    times?: Map<string, ScheduledItem>;
  }

  let {
    items,
    labels,
    canEdit,
    highlighted,
    onEdit,
    onEditStay = () => {},
    onMove,
    onDelete,
    onHover,
    onDrop,
    after,
    times = new Map(),
  }: Props = $props();

  /** Étapes et dossiers à la racine du jour (sans les séjours), dans l'ordre. */
  const roots = $derived(
    items.filter((i) => i.kind !== 'stay').map((i) => (i.kind === 'step' ? i.step : i.group)),
  );

  /** Index de dépôt avant la racine n°`i`, sans compter l'élément déplacé. */
  function rootIndex(stepId: string, i: number) {
    return roots.slice(0, i).filter((s) => s.id !== stepId).length;
  }

  function rootPosition(item: TimelineItem) {
    return roots.findIndex((s) => s.id === item.key);
  }
</script>

{#if items.length === 0}
  <div class="empty">
    <p>Aucune étape pour ce jour.</p>
    {#if canEdit}
      <p class="muted">Ajoute un lieu, ou glisse ici une idée ou une étape d’un autre jour.</p>
      <DropZone
        label="Déposer dans ce jour"
        onDrop={(id) => onDrop(id, { parentId: null, index: 0 })}
      />
    {/if}
  </div>
{:else}
  <div class="timeline" role="list">
    {#each items as item (item.key)}
      {#if item.kind === 'stay'}
        {#if item.edge === 'end' && canEdit}
          <DropZone
            label="Déposer à la fin du jour"
            onDrop={(id) => onDrop(id, { parentId: null, index: rootIndex(id, roots.length) })}
          />
        {/if}
        <div class="stay-row">
          <span class="clock" aria-hidden="true"
            >{item.edge === 'start' ? item.stay.checkOutTime : item.stay.checkInTime}</span
          >
          <StayCard {item} highlighted={highlighted === item.key} onEdit={onEditStay} {onHover} />
        </div>
        {@render after?.(item.key)}
      {:else}
        {#if canEdit}
          <DropZone
            label="Déposer ici"
            onDrop={(id) =>
              onDrop(id, { parentId: null, index: rootIndex(id, rootPosition(item)) })}
          />
        {/if}
        {#if item.kind === 'step'}
          <StepCard
            step={item.step}
            label={labels.get(item.step.id) ?? null}
            {canEdit}
            highlighted={highlighted === item.step.id}
            time={times.get(item.step.id) ?? null}
            timeColumn
            {onEdit}
            {onMove}
            {onDelete}
            {onHover}
          />
          {@render after?.(item.step.id)}
        {:else}
          <GroupCard
            {item}
            timeColumn
            {labels}
            {canEdit}
            {highlighted}
            {onEdit}
            {onMove}
            {onDelete}
            {onHover}
            {after}
            {times}
            onDropInto={(id, index) => onDrop(id, { parentId: item.group.id, index })}
          />
        {/if}
      {/if}
    {/each}
    {#if canEdit && !items.some((i) => i.kind === 'stay' && i.edge === 'end')}
      <DropZone
        label="Déposer à la fin du jour"
        onDrop={(id) => onDrop(id, { parentId: null, index: rootIndex(id, roots.length) })}
      />
    {/if}
  </div>
{/if}

<style>
  /*
   * Agenda de la maquette : colonne d'heures (44 px), rail pointillé, puis les cartes. Les tuiles
   * de trajet et le temps libre s'alignent sur le rail via --leg-indent.
   */
  .timeline {
    --clock-width: 44px;
    --clock-gap: 8px;
    --leg-indent: calc(var(--clock-width) + var(--clock-gap) + 16px);
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
  }

  .timeline::before {
    content: '';
    position: absolute;
    z-index: -1;
    top: var(--space-4);
    bottom: var(--space-4);
    left: calc(var(--clock-width) + var(--clock-gap) + 6px);
    border-left: 2px dashed var(--line);
  }

  /* Zones de dépôt alignées sur les cartes (hauteur inchangée, voir DropZone). */
  .timeline > :global([data-testid='drop-zone']) {
    margin-left: calc(var(--clock-width) + var(--clock-gap));
  }

  .stay-row {
    display: grid;
    grid-template-columns: var(--clock-width) 1fr;
    gap: var(--clock-gap);
    align-items: center;
  }

  .clock {
    font: 500 11px var(--font-mono);
    color: var(--muted);
    text-align: right;
  }

  .empty {
    padding: var(--space-6);
    border: 2px dashed var(--line);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .empty p {
    margin: 0;
  }

  .muted {
    margin-top: var(--space-1) !important;
    color: var(--muted);
    font-size: 13px;
  }
</style>
