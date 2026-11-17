<script lang="ts">
  import type { ScheduledItem, Step, StayItem, TimelineItem } from '@mytrips/core';
  import type { Snippet } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import { plural } from '#lib/format.ts';
  import { endDrag, startDrag, type DropTarget } from '#lib/steps/dnd.svelte.ts';
  import { GROUP_ICON, STAY_ICON } from '#lib/steps/icons.ts';
  import DropZone from './DropZone.svelte';
  import MetroStop from './MetroStop.svelte';

  /**
   * La journée en « ligne de métro » horizontale : mêmes données, mêmes actions et mêmes tuiles
   * de trajet que la liste (Timeline), présentées en stations le long d'une ligne.
   */
  interface Props {
    items: TimelineItem[];
    labels: Map<string, string>;
    canEdit: boolean;
    highlighted: string | null;
    onEdit: (step: Step) => void;
    onEditStay?: (item: StayItem) => void;
    onMove: (step: Step, delta: -1 | 1) => void;
    onDelete: (step: Step) => void;
    onHover: (key: string | null) => void;
    onDrop: (stepId: string, target: DropTarget) => void;
    /** Tuile de trajet après un point de passage (la même que dans la liste). */
    after?: Snippet<[string]>;
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

  const roots = $derived(
    items.filter((i) => i.kind !== 'stay').map((i) => (i.kind === 'step' ? i.step : i.group)),
  );
  function rootIndex(stepId: string, i: number) {
    return roots.slice(0, i).filter((s) => s.id !== stepId).length;
  }
  function rootPosition(item: TimelineItem) {
    return roots.findIndex((s) => s.id === item.key);
  }

  /** Dossiers repliés (par identifiant). */
  const folded = new SvelteSet<string>();
  function toggle(id: string) {
    if (folded.has(id)) folded.delete(id);
    else folded.add(id);
  }

  const stayLabels = {
    'check-in': 'Check-in',
    'check-out': 'Check-out',
    départ: 'Départ',
    retour: 'Retour',
  };
  const StayIcon = STAY_ICON;
  const GroupIcon = GROUP_ICON;
</script>

{#snippet stay(item: StayItem)}
  <div
    class="stay"
    data-testid="metro-stay"
    role="listitem"
    onmouseenter={() => onHover(item.key)}
    onmouseleave={() => onHover(null)}
  >
    <div class="top">
      <span class="start"
        >{item.edge === 'start' ? item.stay.checkOutTime : item.stay.checkInTime}</span
      >
    </div>
    <button
      type="button"
      class="node"
      class:hl={highlighted === item.key}
      aria-label={`${item.stay.name} · ${stayLabels[item.label]}`}
      onclick={() => onEditStay(item)}><StayIcon size={15} /></button
    >
    <div class="bottom">
      <span class="name">{item.stay.name}</span>
      <span class="meta">{stayLabels[item.label]}</span>
    </div>
  </div>
{/snippet}

{#snippet slot(key: string)}
  <!-- Tuile de trajet centrée sur la ligne. -->
  <div class="slot">{@render after?.(key)}</div>
{/snippet}

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
  <div class="metro" role="list" aria-label="Étapes du jour">
    {#each items as item (item.key)}
      {#if item.kind === 'stay'}
        {#if item.edge === 'end' && canEdit}
          <DropZone
            vertical
            label="Déposer à la fin du jour"
            onDrop={(id) => onDrop(id, { parentId: null, index: rootIndex(id, roots.length) })}
          />
        {/if}
        {@render stay(item)}
        {@render slot(item.key)}
      {:else}
        {#if canEdit}
          <DropZone
            vertical
            label="Déposer ici"
            onDrop={(id) =>
              onDrop(id, { parentId: null, index: rootIndex(id, rootPosition(item)) })}
          />
        {/if}
        {#if item.kind === 'step'}
          <MetroStop
            step={item.step}
            label={labels.get(item.step.id) ?? null}
            {canEdit}
            highlighted={highlighted === item.step.id}
            time={times.get(item.step.id) ?? null}
            {onEdit}
            {onMove}
            {onDelete}
            {onHover}
          />
          {@render slot(item.step.id)}
        {:else}
          {@const group = item.group}
          {@const open = !folded.has(group.id)}
          <div class="group" data-testid="metro-group" role="listitem">
            <div class="children" role="list">
              {#if open}
                {#each item.children as child, i (child.id)}
                  {#if canEdit}
                    <DropZone
                      vertical
                      stepsOnly
                      label={`Déposer dans ${group.name}`}
                      onDrop={(id) =>
                        onDrop(id, {
                          parentId: group.id,
                          index: item.children.slice(0, i).filter((c) => c.id !== id).length,
                        })}
                    />
                  {/if}
                  <MetroStop
                    step={child}
                    label={labels.get(child.id) ?? null}
                    {canEdit}
                    highlighted={highlighted === child.id}
                    time={times.get(child.id) ?? null}
                    {onEdit}
                    {onMove}
                    {onDelete}
                    {onHover}
                  />
                  <!-- Le trajet qui suit la dernière étape sort du dossier (comme dans la liste). -->
                  {#if i < item.children.length - 1}{@render slot(child.id)}{/if}
                {/each}
                {#if canEdit}
                  <DropZone
                    vertical
                    stepsOnly
                    label={`Déposer à la fin de ${group.name}`}
                    onDrop={(id) =>
                      onDrop(id, {
                        parentId: group.id,
                        index: item.children.filter((c) => c.id !== id).length,
                      })}
                  />
                {/if}
              {/if}
            </div>
            <div
              class="group-head"
              role="presentation"
              draggable={canEdit ? 'true' : 'false'}
              ondragstart={(e) => startDrag(e, group.id, 'group')}
              ondragend={endDrag}
            >
              <button
                type="button"
                class="toggle"
                class:open
                aria-label={`${open ? 'Replier' : 'Déplier'} ${group.name}`}
                aria-expanded={open}
                onclick={() => toggle(group.id)}><ChevronRight size={14} /></button
              >
              <button type="button" class="title" onclick={() => onEdit(group)}>
                <GroupIcon size={14} />
                <span>{group.name}</span>
                <small>{plural(item.children.length, 'étape')}</small>
              </button>
            </div>
          </div>
          {@const last = item.children.at(-1)}
          {#if last}{@render slot(last.id)}{/if}
        {/if}
      {/if}
    {/each}
    {#if canEdit && !items.some((i) => i.kind === 'stay' && i.edge === 'end')}
      <DropZone
        vertical
        label="Déposer à la fin du jour"
        onDrop={(id) => onDrop(id, { parentId: null, index: rootIndex(id, roots.length) })}
      />
    {/if}
  </div>
{/if}

<style>
  /*
   * Une seule ligne horizontale, dessinée en fond à hauteur fixe ; stations, dossiers, tuiles et
   * zones de dépôt ont la même hauteur de tête (--metro-top) pour que la ligne passe au milieu de
   * leurs nœuds. Défilement horizontal si la journée est longue.
   */
  .metro {
    --metro-top: 62px;
    --metro-node: 34px;
    --leg-offset: 0px;
    display: flex;
    align-items: flex-start;
    width: max-content;
    min-width: 100%;
    padding: 0 var(--space-3) var(--space-3);
    background: linear-gradient(
        color-mix(in srgb, var(--accent) 45%, var(--line)),
        color-mix(in srgb, var(--accent) 45%, var(--line))
      )
      0 calc(var(--metro-top) + var(--metro-node) / 2 - 2px) / 100% 4px no-repeat;
  }

  .slot {
    flex: none;
    display: flex;
    align-items: center;
    min-height: var(--metro-node);
    margin-top: var(--metro-top);
  }

  .slot:empty {
    width: var(--space-4);
  }

  .stay {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 120px;
    text-align: center;
  }

  .top {
    display: flex;
    align-items: flex-end;
    height: var(--metro-top);
    padding-bottom: var(--space-1);
  }

  .start {
    font: 700 15px var(--font-mono);
  }

  .node {
    display: grid;
    place-items: center;
    width: var(--metro-node);
    height: var(--metro-node);
    border: 3px solid var(--surface);
    border-radius: 50%;
    background: var(--type-hotel);
    color: var(--on-type);
    box-shadow: 0 0 0 2px var(--type-hotel);
    cursor: pointer;
  }

  .node.hl {
    box-shadow:
      0 0 0 2px var(--type-hotel),
      0 0 0 6px color-mix(in srgb, var(--type-hotel) 30%, transparent);
  }

  .bottom {
    display: flex;
    flex-direction: column;
    padding-top: var(--space-2);
  }

  .name {
    font: 700 12.5px/1.2 var(--font-display);
  }

  .meta {
    font-size: 11px;
    color: var(--muted);
  }

  /* Dossier : cadre pointillé autour de ses stations, nom en pied (la ligne reste alignée). */
  .group {
    flex: none;
    display: flex;
    flex-direction: column;
    border: 1.5px var(--group-edge-style) var(--group-edge);
    border-top: 0;
    border-radius: 0 0 var(--group-radius) var(--group-radius);
    background: color-mix(in srgb, var(--accent) 4%, transparent);
  }

  .children {
    display: flex;
    align-items: flex-start;
    min-height: calc(var(--metro-top) + var(--metro-node));
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-top: 1px dashed var(--group-edge);
  }

  .group-head[draggable='true'] {
    cursor: grab;
  }

  .toggle {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: transform 0.15s;
  }

  .toggle.open {
    transform: rotate(90deg);
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    border: 0;
    background: transparent;
    color: var(--fg);
    font: 700 12.5px var(--font-display);
    cursor: pointer;
  }

  .title small {
    font: 400 11px var(--font-body);
    color: var(--muted);
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
