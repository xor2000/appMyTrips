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

<!--
  Trajet facultatif. Existant : une ligne fine sur le pointillé de la timeline. Absent : rien, sinon
  l'ajout (« + trajet » et les modes) qui apparaît au survol de l'espace entre les deux lieux, en
  surimpression (la liste ne bouge pas) ; toujours affiché s'il y a un trajet à reprendre.
-->
<div
  class="leg"
  class:vacant={!leg}
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
      class="line"
      class:highlighted
      style={`--c: var(${LEG_MODE_INFO[leg.mode].color})`}
      onclick={() => onEdit(leg)}
    >
      <span class="icon"><Icon size={13} /></span>
      <span class="visually-hidden">{LEG_MODE_INFO[leg.mode].label}</span>
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
  {:else if canEdit}
    <div class="reveal" class:shown={suggestion !== null}>
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
            <Icon size={14} />
          </button>
        {/each}
      </div>
      {#if suggestion}
        <button type="button" class="resume" disabled={busy} onclick={() => resume(suggestion)}
          >Reprendre : {LEG_MODE_INFO[suggestion.mode].label}
          {formatDuration(suggestion.durationMin)}</button
        >
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Trajet centré sur la ligne de la timeline. */
  .leg {
    position: relative;
    display: flex;
    justify-content: center;
    /* --leg-offset : hauteur de la zone de dépôt qui suit le trajet (voir Timeline). */
    padding: calc(2px + var(--leg-offset, 0px)) 0 2px;
  }

  /* Sans trajet : un simple interstice entre les deux lieux, qui sert de zone de survol. */
  .leg.vacant {
    height: 10px;
    padding: 0;
  }

  .line {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    height: 22px;
    padding: 0 10px 0 4px;
    border: 0;
    border-radius: var(--radius-pill);
    /* Fond plein : le pointillé de la timeline ne traverse pas le texte. */
    background: color-mix(in srgb, var(--c) var(--leg-tint), var(--leg-base));
    color: var(--fg);
    font: 600 11.5px var(--font-body);
    white-space: nowrap;
    cursor: pointer;
    transition: box-shadow 0.15s;
  }

  .line.highlighted,
  .line:hover {
    box-shadow: 0 0 0 2px var(--c);
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--c) var(--leg-icon-tint), transparent);
    color: color-mix(in srgb, var(--c) var(--leg-icon-ink), var(--surface));
  }

  .values {
    font-family: var(--font-mono);
  }

  .source {
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 10.5px;
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
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    font-weight: 500;
    text-overflow: ellipsis;
  }

  /* Ajout en surimpression, centré sur l'interstice : visible au survol ou au clavier. */
  .reveal {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 50%;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 1px var(--space-2);
    border: 1.5px dashed var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition: opacity 0.12s;
  }

  .leg:hover .reveal,
  .reveal:focus-within,
  .reveal.shown {
    opacity: 1;
    pointer-events: auto;
  }

  /* Affiché en permanence (trajet à reprendre) : il prend sa place dans la liste. */
  .leg.vacant:has(.reveal.shown) {
    height: auto;
    padding: 2px 0;
  }

  .reveal.shown {
    position: static;
    transform: none;
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
    min-width: 24px;
    height: 24px;
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
