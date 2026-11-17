<script lang="ts">
  import { STEP_TYPE_INFO, type ScheduledItem, type Step } from '@mytrips/core';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Hourglass from 'lucide-svelte/icons/hourglass';
  import Lock from 'lucide-svelte/icons/lock';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import { formatDuration, formatKm } from '#lib/format.ts';
  import { endDrag, startDrag } from '#lib/steps/dnd.svelte.ts';
  import { STEP_ICONS } from '#lib/steps/icons.ts';

  interface Props {
    step: Step;
    label?: string | null;
    canEdit: boolean;
    highlighted: boolean;
    time?: ScheduledItem | null;
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
    time = null,
    onEdit,
    onMove,
    onDelete,
    onHover,
  }: Props = $props();

  const info = $derived(step.type ? STEP_TYPE_INFO[step.type] : null);
  const Icon = $derived(step.type ? STEP_ICONS[step.type] : null);
  const late = $derived(
    time?.issues.reduce((t, i) => t + (i.kind === 'conflict' ? i.lateMin : 0), 0) ?? 0,
  );
  const end = $derived(
    time ? `${time.end.time}${time.end.dayOffset > 0 ? ` (+${time.end.dayOffset} j)` : ''}` : '',
  );
</script>

<!-- Station de la ligne de métro : mêmes informations et actions qu'une carte de la liste. -->
<div
  class="stop"
  class:highlighted
  class:conflict={late > 0}
  data-testid="metro-stop"
  data-step-id={step.id}
  role="listitem"
  draggable={canEdit ? 'true' : 'false'}
  style={`--c: var(${info?.color ?? '--type-transport'})`}
  ondragstart={(e) => startDrag(e, step.id, step.kind)}
  ondragend={endDrag}
  onmouseenter={() => onHover(step.id)}
  onmouseleave={() => onHover(null)}
>
  <div class="top">
    {#if time && time.freeBeforeMin >= 5}
      <span class="free"
        ><Hourglass size={11} aria-hidden="true" />{formatDuration(time.freeBeforeMin)} de temps libre</span
      >
    {/if}
    {#if time}
      <span class="visually-hidden">{time.start.time} → {end}</span>
      <span class="start" aria-hidden="true">{time.start.time}</span>
      <span class="end" aria-hidden="true">→ {end}</span>
    {/if}
  </div>
  <button
    type="button"
    class="node"
    aria-label={`${step.name} · ${info?.label ?? 'Étape'}`}
    onclick={() => onEdit(step)}
  >
    {#if Icon}<Icon size={15} />{/if}
    {#if label}<span class="label">{label}</span>{/if}
  </button>
  <div class="bottom">
    <span class="name">{step.name}</span>
    <span class="meta">{info?.label ?? 'Étape'} · {formatDuration(step.durationMin)}</span>
    <span class="chips">
      {#if late > 0}<span class="chip late">Conflit +{formatDuration(late)}</span>{/if}
      {#if step.fixedStart}<span class="chip fixed" title="Heure fixe"
          ><Lock size={10} />{step.fixedStart}</span
        >{/if}
      {#if step.gpx}<span class="chip gpx">GPX {formatKm(step.gpx.stats.distanceM)}</span>{/if}
      {#if step.bookingRef}<span class="chip booking">Résa {step.bookingRef}</span>{/if}
    </span>
    {#if canEdit}
      <span class="actions">
        <button
          type="button"
          aria-label={`Plus tôt : ${step.name}`}
          onclick={() => onMove(step, -1)}><ChevronLeft size={15} /></button
        >
        <button
          type="button"
          aria-label={`Plus tard : ${step.name}`}
          onclick={() => onMove(step, 1)}><ChevronRight size={15} /></button
        >
        <button type="button" aria-label={`Supprimer ${step.name}`} onclick={() => onDelete(step)}
          ><Trash2 size={14} /></button
        >
      </span>
    {/if}
  </div>
</div>

<style>
  /* Hauteurs fixes en haut (--metro-top) et au nœud (--metro-node) : la ligne passe au centre. */
  .stop {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 148px;
    padding: 0 var(--space-1);
    text-align: center;
  }

  .stop[draggable='true'] {
    cursor: grab;
  }

  .top {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: var(--metro-top);
    padding-bottom: var(--space-1);
  }

  .free {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-bottom: var(--space-1);
    padding: 1px var(--space-2);
    border: 1.5px dashed var(--ok);
    border-radius: var(--radius-pill);
    background: var(--ok-soft);
    color: var(--ok);
    font: 700 10.5px var(--font-display);
    white-space: nowrap;
  }

  .start {
    font: 700 17px/1.1 var(--font-mono);
    color: var(--fg);
  }

  .conflict .start {
    color: var(--bad);
  }

  .end {
    font: 500 10.5px var(--font-mono);
    color: var(--muted);
  }

  .node {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--metro-node);
    height: var(--metro-node);
    border: 3px solid var(--surface);
    border-radius: var(--icon-radius);
    background: var(--c);
    color: var(--on-type);
    box-shadow: 0 0 0 2px var(--c);
    cursor: pointer;
  }

  .highlighted .node {
    box-shadow:
      0 0 0 2px var(--c),
      0 0 0 6px color-mix(in srgb, var(--c) 30%, transparent);
  }

  .conflict .node {
    box-shadow: 0 0 0 3px var(--bad);
  }

  .label {
    position: absolute;
    top: -9px;
    right: -11px;
    min-width: 17px;
    height: 17px;
    padding: 0 3px;
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--fg);
    font: 700 10.5px/17px var(--font-display);
    box-shadow: var(--shadow-card);
  }

  .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-top: var(--space-2);
  }

  .name {
    display: -webkit-box;
    max-width: 100%;
    overflow: hidden;
    font: 700 12.5px/1.2 var(--font-display);
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .meta {
    font-size: 11px;
    color: var(--muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px;
  }

  .chip {
    padding: 0 6px;
    border-radius: 6px;
    font-size: 10px;
  }

  .late {
    background: var(--bad-soft);
    color: var(--bad);
  }

  .fixed {
    gap: 2px;
    background: color-mix(in srgb, var(--type-air) 16%, transparent);
    color: var(--type-air);
  }

  .gpx {
    background: var(--ok-soft);
    color: var(--ok);
  }

  .booking {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.12s;
  }

  .stop:hover .actions,
  .stop:focus-within .actions {
    opacity: 1;
  }

  .actions button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 22px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--muted);
    cursor: pointer;
  }

  .actions button:hover {
    color: var(--fg);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
