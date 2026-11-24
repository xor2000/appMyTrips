<script lang="ts">
  import { sortByPosition, type Step } from '@mytrips/core';
  import Lightbulb from 'lucide-svelte/icons/lightbulb';
  import type { MenuPoint } from '#lib/steps/contextMenu.ts';
  import type { DropTarget } from '#lib/steps/dnd.svelte.ts';
  import DropZone from './DropZone.svelte';
  import StepCard from './StepCard.svelte';

  interface Props {
    /** Étapes sans jour, à la racine. */
    ideas: Step[];
    canEdit: boolean;
    highlighted: string | null;
    onAdd: () => void;
    onEdit: (step: Step) => void;
    onContextMenu: (step: Step, point: MenuPoint) => void;
    onHover: (key: string | null) => void;
    onDrop: (stepId: string, target: DropTarget) => void;
  }

  let { ideas, canEdit, highlighted, onAdd, onEdit, onContextMenu, onHover, onDrop }: Props =
    $props();

  const sorted = $derived(sortByPosition(ideas));

  function indexWithout(stepId: string, i: number) {
    return sorted.slice(0, i).filter((s) => s.id !== stepId).length;
  }
</script>

<section class="ideas" aria-labelledby="ideas-title">
  <header>
    <h3 id="ideas-title"><Lightbulb size={16} /> Idées</h3>
    {#if canEdit}
      <button type="button" class="btn btn-soft add" onclick={onAdd}>Ajouter une idée</button>
    {/if}
  </header>
  {#if sorted.length === 0}
    <p class="empty">
      Aucune idée pour l’instant. Note ici les lieux à voir, puis glisse-les dans un jour.
    </p>
  {/if}
  <div class="list" role="list">
    {#each sorted as idea, i (idea.id)}
      {#if canEdit}
        <DropZone
          label="Déposer dans les idées"
          onDrop={(id) => onDrop(id, { dayId: null, parentId: null, index: indexWithout(id, i) })}
        />
      {/if}
      <StepCard
        step={idea}
        {canEdit}
        highlighted={highlighted === idea.id}
        {onEdit}
        {onContextMenu}
        {onHover}
      />
    {/each}
    {#if canEdit}
      <DropZone
        label="Déposer dans les idées"
        onDrop={(id) =>
          onDrop(id, { dayId: null, parentId: null, index: indexWithout(id, sorted.length) })}
      />
    {/if}
  </div>
</section>

<style>
  .ideas {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--warn) 7%, var(--surface));
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 16px;
  }

  .add {
    min-height: 30px;
    font-size: 13px;
  }

  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .list {
    display: flex;
    flex-direction: column;
  }
</style>
