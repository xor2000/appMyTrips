<script lang="ts">
  import { legColorVar, type GroupItem, type ScheduledItem, type Step } from '@mytrips/core';
  import type { Snippet } from 'svelte';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import { plural } from '#lib/format.ts';
  import { contextMenuKey, type MenuPoint } from '#lib/steps/contextMenu.ts';
  import { endDrag, startDrag } from '#lib/steps/dnd.svelte.ts';
  import { GROUP_ICON, STEP_ICONS } from '#lib/steps/icons.ts';
  import DropZone from './DropZone.svelte';
  import StepCard from './StepCard.svelte';

  interface Props {
    item: GroupItem;
    labels: Map<string, string>;
    canEdit: boolean;
    highlighted: string | null;
    onEdit: (step: Step) => void;
    /** Menu contextuel d'une étape du dossier ou du dossier lui-même (en-tête). */
    onContextMenu: (step: Step, point: MenuPoint) => void;
    /** Dépôt dans le dossier, à l'index donné parmi ses étapes (sans l'élément déplacé). */
    onDropInto: (stepId: string, index: number) => void;
    /** Rendu après chaque étape du dossier sauf la dernière : tuile de trajet. */
    after?: Snippet<[string]>;
    times?: Map<string, ScheduledItem>;
    /** Variante compacte (colonne des idées). */
    dense?: boolean;
  }

  let {
    item,
    labels,
    canEdit,
    highlighted,
    onEdit,
    onContextMenu,
    onDropInto,
    after,
    times = new Map(),
    dense = false,
  }: Props = $props();

  let open = $state(true);
  /** Icône choisie du dossier (type d'étape), sinon l'icône dossier. */
  const iconType = $derived(item.group.icon ?? null);
  const Icon = $derived(iconType ? STEP_ICONS[iconType] : GROUP_ICON);
  /** Couleur choisie (palette des trajets), sinon l'accent du thème. */
  const tint = $derived(
    item.group.color !== null && item.group.color !== undefined
      ? `var(${legColorVar(item.group.color)})`
      : 'var(--accent)',
  );

  function indexWithout(stepId: string, i: number) {
    return item.children.slice(0, i).filter((c) => c.id !== stepId).length;
  }
</script>

<div
  class="group-row"
  class:dense
  role="listitem"
  data-testid="group-card"
  data-step-id={item.group.id}
  data-icon={iconType ?? 'folder'}
  style={`--gc: ${tint}`}
>
  <div class="group">
    <div
      class="header"
      role="presentation"
      draggable={canEdit ? 'true' : 'false'}
      ondragstart={(e) => startDrag(e, item.group.id, 'group')}
      ondragend={endDrag}
      oncontextmenu={(e) => {
        e.preventDefault();
        onContextMenu(item.group, { x: e.clientX, y: e.clientY });
      }}
    >
      <button
        type="button"
        class="toggle"
        class:open
        aria-label={`${open ? 'Replier' : 'Déplier'} ${item.group.name}`}
        aria-expanded={open}
        onclick={() => (open = !open)}
      >
        <ChevronRight size={16} />
      </button>
      <button
        type="button"
        class="title"
        aria-expanded={open}
        onclick={() => (open = !open)}
        onkeydown={(e) => {
          const point = contextMenuKey(e);
          if (point) onContextMenu(item.group, point);
        }}
      >
        <span class="icon"><Icon size={16} /></span>
        <span class="name">{item.group.name}</span>
        {#if times.get(item.group.id)}
          {@const t = times.get(item.group.id)!}
          <span class="times">{t.start.time} → {t.end.time}</span>
        {/if}
        <span class="count">{plural(item.children.length, 'étape')}</span>
      </button>
    </div>
    {#if open}
      <div class="children" role="list">
        {#each item.children as child, i (child.id)}
          {#if canEdit}
            <DropZone
              stepsOnly
              {dense}
              label={`Déposer dans ${item.group.name}`}
              onDrop={(id) => onDropInto(id, indexWithout(id, i))}
            />
          {/if}
          <StepCard
            step={child}
            label={labels.get(child.id) ?? null}
            {canEdit}
            {dense}
            highlighted={highlighted === child.id}
            time={times.get(child.id) ?? null}
            {onEdit}
            {onContextMenu}
          />
          <!-- Le trajet qui suit la dernière étape sort du dossier (rendu par la timeline). -->
          {#if i < item.children.length - 1}
            {@render after?.(child.id)}
          {/if}
        {/each}
        {#if canEdit}
          <DropZone
            stepsOnly
            {dense}
            label={`Déposer à la fin de ${item.group.name}`}
            onDrop={(id) => onDropInto(id, indexWithout(id, item.children.length))}
          />
        {/if}
        {#if item.children.length === 0}
          <p class="empty">Glissez des étapes ici.</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    padding: var(--space-2);
    border: 1.5px var(--group-edge-style) color-mix(in srgb, var(--gc) 45%, var(--group-edge));
    border-radius: var(--group-radius);
    background: color-mix(in srgb, var(--gc) 6%, var(--surface));
  }

  /* Variante compacte (idées) : marges et en-tête réduits. */
  .dense .group {
    gap: 0;
    padding: var(--space-1) var(--space-2);
  }

  .dense .toggle {
    width: 22px;
    height: 22px;
  }

  .dense .name {
    font-size: 13px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .header[draggable='true'] {
    cursor: grab;
  }

  .toggle {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
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
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: 0;
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }

  .icon {
    color: var(--gc);
    display: grid;
  }

  .name {
    font: 700 14px var(--font-display);
  }

  .times {
    font: 600 12px var(--font-mono);
    color: var(--muted);
  }

  .count {
    font-size: 12px;
    color: var(--muted);
  }

  .children {
    display: flex;
    flex-direction: column;
    padding-left: var(--space-2);
  }

  .empty {
    margin: 0;
    padding: var(--space-2);
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
</style>
