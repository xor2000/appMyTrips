<script lang="ts">
  import { sortByPosition, type GroupItem, type Step } from '@mytrips/core';
  import FolderPlus from 'lucide-svelte/icons/folder-plus';
  import Lightbulb from 'lucide-svelte/icons/lightbulb';
  import type { MenuPoint } from '#lib/steps/contextMenu.ts';
  import type { DropTarget } from '#lib/steps/dnd.svelte.ts';
  import DropZone from './DropZone.svelte';
  import GroupCard from './GroupCard.svelte';
  import StepCard from './StepCard.svelte';

  interface Props {
    /** Étapes et dossiers sans jour (racines et étapes rangées dans un dossier d'idées). */
    ideas: Step[];
    canEdit: boolean;
    highlighted: string | null;
    /** Bouton « Nouveau dossier d'idées » de l'en-tête. */
    onAddGroup: () => void;
    onEdit: (step: Step) => void;
    onContextMenu: (step: Step, point: MenuPoint) => void;
    onHover: (key: string | null) => void;
    onDrop: (stepId: string, target: DropTarget) => void;
  }

  let { ideas, canEdit, highlighted, onAddGroup, onEdit, onContextMenu, onHover, onDrop }: Props =
    $props();

  /** Racines triées ; un dossier porte ses idées, triées elles aussi. */
  const roots = $derived(
    sortByPosition(ideas.filter((s) => s.parentId === null)).map((s) =>
      s.kind === 'group'
        ? ({
            kind: 'group',
            key: s.id,
            group: s,
            children: sortByPosition(ideas.filter((c) => c.parentId === s.id)),
          } satisfies GroupItem)
        : s,
    ),
  );

  const rootId = (r: Step | GroupItem) => ('group' in r ? r.group.id : r.id);
  /** Les idées n'ont pas de numéro sur la carte. */
  const NO_LABELS = new Map<string, string>();

  function indexWithout(stepId: string, i: number) {
    return roots.slice(0, i).filter((r) => rootId(r) !== stepId).length;
  }
</script>

<section class="ideas" aria-labelledby="ideas-title">
  <header>
    <h3 id="ideas-title"><Lightbulb size={16} /> Idées</h3>
    {#if canEdit}
      <button
        type="button"
        class="icon-btn add"
        aria-label="Nouveau dossier d’idées"
        title="Nouveau dossier d’idées"
        onclick={onAddGroup}><FolderPlus size={17} aria-hidden="true" /></button
      >
    {/if}
  </header>
  {#if roots.length === 0}
    <p class="empty">
      Aucune idée pour l’instant. Note ici les lieux à voir, puis glisse-les dans un jour.
    </p>
  {/if}
  <div class="list" role="list">
    {#each roots as root, i (rootId(root))}
      {#if canEdit}
        <DropZone
          dense
          label="Déposer dans les idées"
          onDrop={(id) => onDrop(id, { dayId: null, parentId: null, index: indexWithout(id, i) })}
        />
      {/if}
      {#if 'group' in root}
        <GroupCard
          item={root}
          labels={NO_LABELS}
          {canEdit}
          {highlighted}
          {onEdit}
          {onContextMenu}
          {onHover}
          dense
          onDropInto={(id, index) => onDrop(id, { dayId: null, parentId: root.group.id, index })}
        />
      {:else}
        <StepCard
          step={root}
          {canEdit}
          dense
          highlighted={highlighted === root.id}
          {onEdit}
          {onContextMenu}
          {onHover}
        />
      {/if}
    {/each}
    {#if canEdit}
      <DropZone
        dense
        label="Déposer dans les idées"
        onDrop={(id) =>
          onDrop(id, { dayId: null, parentId: null, index: indexWithout(id, roots.length) })}
      />
    {/if}
  </div>
</section>

<style>
  .ideas {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
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
    width: 30px;
    height: 30px;
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
