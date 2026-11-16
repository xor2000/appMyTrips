<script lang="ts">
  import { STEP_TYPE_INFO, type Step } from '@mytrips/core';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronUp from 'lucide-svelte/icons/chevron-up';
  import Lock from 'lucide-svelte/icons/lock';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import { formatDuration } from '#lib/format.ts';
  import { endDrag, startDrag } from '#lib/steps/dnd.svelte.ts';
  import { GROUP_ICON, STEP_ICONS } from '#lib/steps/icons.ts';

  interface Props {
    step: Step;
    /** Numéro affiché sur la carte, s'il y en a un. */
    label?: string | null;
    canEdit: boolean;
    highlighted: boolean;
    onEdit: (step: Step) => void;
    onMove: (step: Step, delta: -1 | 1) => void;
    onDelete: (step: Step) => void;
    onHover: (key: string | null) => void;
  }

  let {
    step,
    label = null,
    canEdit,
    highlighted,
    onEdit,
    onMove,
    onDelete,
    onHover,
  }: Props = $props();

  const info = $derived(step.type ? STEP_TYPE_INFO[step.type] : null);
  const Icon = $derived(
    step.type ? STEP_ICONS[step.type] : step.kind === 'group' ? GROUP_ICON : null,
  );
</script>

<div
  class="card"
  class:highlighted
  data-testid="step-card"
  data-step-id={step.id}
  role="listitem"
  draggable={canEdit ? 'true' : 'false'}
  style={`--c: var(${info?.color ?? '--type-transport'})`}
  ondragstart={(e) => startDrag(e, step.id, step.kind)}
  ondragend={endDrag}
  onmouseenter={() => onHover(step.id)}
  onmouseleave={() => onHover(null)}
>
  <button type="button" class="main" onclick={() => onEdit(step)}>
    <span class="icon">
      {#if Icon}<Icon size={18} />{/if}
      {#if label}<span class="label">{label}</span>{/if}
    </span>
    <span class="text">
      <span class="name">{step.name}</span>
      <span class="meta">
        {#if step.kind === 'group'}
          Dossier
        {:else}
          {info?.label ?? 'Étape'} · {formatDuration(step.durationMin)} sur place
        {/if}
      </span>
    </span>
    <span class="pills">
      {#if step.fixedStart}
        <span class="chip fixed" title="Heure fixe"><Lock size={11} />{step.fixedStart}</span>
      {/if}
      {#if step.bookingRef}
        <span class="chip booking">Résa {step.bookingRef}</span>
      {/if}
    </span>
  </button>
  {#if canEdit}
    <div class="actions">
      <button type="button" aria-label={`Monter ${step.name}`} onclick={() => onMove(step, -1)}>
        <ChevronUp size={16} />
      </button>
      <button type="button" aria-label={`Descendre ${step.name}`} onclick={() => onMove(step, 1)}>
        <ChevronDown size={16} />
      </button>
      <button type="button" aria-label={`Supprimer ${step.name}`} onclick={() => onDelete(step)}>
        <Trash2 size={15} />
      </button>
    </div>
  {/if}
</div>

<style>
  .card {
    position: relative;
    display: flex;
    align-items: stretch;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--c) 11%, var(--surface));
    box-shadow: 0 2px 0 color-mix(in srgb, var(--c) 28%, transparent);
    transition:
      box-shadow 0.15s,
      transform 0.15s;
  }

  .card[draggable='true'] {
    cursor: grab;
  }

  .card.highlighted {
    box-shadow: 0 0 0 2px var(--c);
    transform: translateX(2px);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 0;
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: inherit;
  }

  .icon {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
  }

  .label {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--fg);
    font: 700 11px/18px var(--font-display);
    text-align: center;
    box-shadow: var(--shadow-card);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    font-family: var(--font-display);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }

  .pills {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .fixed {
    background: color-mix(in srgb, var(--type-air) 16%, transparent);
    color: var(--type-air);
  }

  .booking {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-right: var(--space-1);
    opacity: 0;
    transition: opacity 0.12s;
  }

  .card:hover .actions,
  .card:focus-within .actions {
    opacity: 1;
  }

  .actions button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 22px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .actions button:hover {
    background: var(--surface);
    color: var(--fg);
  }
</style>
