<script lang="ts">
  import { LEG_MODES, LEG_MODE_INFO, legPairKey, type Leg, type LegMode } from '@mytrips/core';
  import { formatDistance, formatDuration } from '#lib/format.ts';
  import { LEG_ICONS, legSourceLabel } from '#lib/legs/legs.ts';

  interface Props {
    pair: { fromKey: string; toKey: string };
    leg: Leg | null;
    canEdit: boolean;
    highlighted: boolean;
    /** Trajet saisi à la main retiré par un réordonnancement, à reprendre en un clic. */
    suggestion: Leg | null;
    onCreate: (input: { mode: LegMode; distanceM?: number; durationMin?: number }) => Promise<void>;
    onEdit: (leg: Leg) => void;
    onHover: (key: string | null) => void;
  }

  let { pair, leg, canEdit, highlighted, suggestion, onCreate, onEdit, onHover }: Props = $props();

  const key = $derived(legPairKey(pair.fromKey, pair.toKey));
  let busy = $state(false);

  async function create(input: { mode: LegMode; distanceM?: number; durationMin?: number }) {
    busy = true;
    try {
      await onCreate(input);
    } finally {
      busy = false;
    }
  }

  function resume(s: Leg) {
    const input: { mode: LegMode; distanceM?: number; durationMin?: number } = { mode: s.mode };
    if (s.durationSource === 'manual') input.durationMin = s.durationMin;
    if (s.distanceSource === 'manual' && s.distanceM !== null) input.distanceM = s.distanceM;
    return create(input);
  }
</script>

<div
  class="leg"
  role="listitem"
  data-testid="leg-tile"
  onmouseenter={() => onHover(key)}
  onmouseleave={() => onHover(null)}
>
  {#if leg}
    {@const Icon = LEG_ICONS[leg.mode]}
    {@const source = legSourceLabel(leg)}
    <button
      type="button"
      class="pill"
      class:highlighted
      style={`--c: var(${LEG_MODE_INFO[leg.mode].color})`}
      disabled={!canEdit}
      onclick={() => onEdit(leg)}
    >
      <span class="icon"><Icon size={14} /></span>
      <span class="label">{LEG_MODE_INFO[leg.mode].label}</span>
      <span class="values">
        {formatDuration(leg.durationMin)}{#if leg.distanceM !== null}&nbsp;· {formatDistance(
            leg.distanceM,
          )}{/if}
      </span>
      <span class="source" class:manual={source === 'forcé'} class:estimate={source === 'estimé'}
        >{source}</span
      >
      {#if leg.summary}<span class="summary">{leg.summary}</span>{/if}
    </button>
  {:else}
    <div class="empty">
      {#if canEdit}
        <span class="plus">+ trajet</span>
        <div class="modes">
          {#each LEG_MODES as mode (mode)}
            {@const Icon = LEG_ICONS[mode]}
            <button
              type="button"
              aria-label={`Trajet en ${LEG_MODE_INFO[mode].label}`}
              title={LEG_MODE_INFO[mode].label}
              disabled={busy}
              onclick={() => create({ mode })}
            >
              <Icon size={15} />
            </button>
          {/each}
        </div>
        {#if suggestion}
          <button type="button" class="resume" disabled={busy} onclick={() => resume(suggestion)}
            >Reprendre : {LEG_MODE_INFO[suggestion.mode].label}
            {formatDuration(suggestion.durationMin)}</button
          >
        {/if}
      {:else}
        <span class="plus">Trajet à définir</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .leg {
    display: flex;
    padding: var(--space-1) 0 var(--space-1) var(--leg-indent, var(--space-6));
  }

  .pill {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    max-width: 100%;
    padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
    border: 0;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--c) 12%, var(--surface));
    color: var(--fg);
    font: 600 12px var(--font-body);
    text-align: left;
    cursor: pointer;
    transition: box-shadow 0.15s;
  }

  .pill:disabled {
    cursor: default;
  }

  .pill.highlighted,
  .pill:hover:not(:disabled) {
    box-shadow: 0 0 0 2px var(--c);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--c);
    color: var(--surface);
  }

  .label {
    font-family: var(--font-display);
  }

  .values {
    font-family: var(--font-mono);
  }

  .source {
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11px;
  }

  .source.manual {
    background: var(--warn-soft);
    color: var(--warn);
  }

  .source.estimate {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .summary {
    flex-basis: 100%;
    padding-left: 32px;
    color: var(--muted);
    font-weight: 500;
  }

  .empty {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border: 1.5px dashed var(--line);
    border-radius: var(--radius-pill);
    color: var(--muted);
    font-size: 12px;
  }

  .plus {
    font-weight: 700;
  }

  .modes {
    display: flex;
    gap: 2px;
  }

  .modes button,
  .resume {
    display: grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .modes button:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .resume {
    padding: 0 var(--space-3);
    background: var(--warn-soft);
    color: var(--warn);
    font: 600 12px var(--font-body);
  }
</style>
