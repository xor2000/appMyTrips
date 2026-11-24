<script lang="ts">
  import { LEG_MODES, LEG_MODE_INFO, legPairKey, type Leg, type LegMode } from '@mytrips/core';
  import Plus from 'lucide-svelte/icons/plus';
  import { formatDistance, formatDuration } from '#lib/format.ts';
  import { LEG_ICONS, legSourceLabel } from '#lib/legs/legs.ts';

  /**
   * Trajet de la ligne de métro : compact, posé sur la ligne comme une station (durée au-dessus,
   * mode et distance dessous). Sans trajet, un « + » se déplie pour choisir le mode. Mêmes
   * actions que la tuile de la liste (LegTile).
   */
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
  let open = $state(false);
  let busy = $state(false);

  async function create(input: { mode: LegMode; distanceM?: number; durationMin?: number }) {
    busy = true;
    try {
      await onCreate(input);
      open = false;
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

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      open = false;
    }
  }
</script>

<!-- Échap replie le choix du mode ; le survol suit la carte (comme les tuiles de la liste). -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="leg"
  class:open
  class:highlighted
  role="listitem"
  data-testid="metro-leg"
  onmouseenter={() => onHover(key)}
  onmouseleave={() => onHover(null)}
  onkeydown={onKeydown}
>
  {#if leg}
    {@const Icon = LEG_ICONS[leg.mode]}
    {@const source = legSourceLabel(leg)}
    <div class="top">
      <span class="duration">{formatDuration(leg.durationMin)}</span>
    </div>
    <button
      type="button"
      class="node"
      style={`--c: var(${LEG_MODE_INFO[leg.mode].color})`}
      aria-label={`Modifier le trajet : ${LEG_MODE_INFO[leg.mode].label} ${formatDuration(leg.durationMin)}`}
      disabled={!canEdit}
      onclick={() => onEdit(leg)}><Icon size={14} /></button
    >
    <div class="bottom">
      <span class="mode">{LEG_MODE_INFO[leg.mode].label}</span>
      {#if leg.distanceM !== null}<span class="km">{formatDistance(leg.distanceM)}</span>{/if}
      {#if source !== 'routeur'}
        <span class="source" class:manual={source === 'forcé'}>{source}</span>
      {/if}
    </div>
  {:else if canEdit}
    <div class="top"></div>
    <button
      type="button"
      class="node add"
      aria-label="Ajouter un trajet"
      aria-expanded={open}
      onclick={() => (open = !open)}><Plus size={14} /></button
    >
    <div class="bottom">
      {#if open}
        <div class="modes">
          {#each LEG_MODES as mode (mode)}
            {@const Icon = LEG_ICONS[mode]}
            <button
              type="button"
              aria-label={`Trajet en ${LEG_MODE_INFO[mode].label}`}
              title={LEG_MODE_INFO[mode].label}
              disabled={busy}
              onclick={() => create({ mode })}><Icon size={14} /></button
            >
          {/each}
        </div>
        {#if suggestion}
          <button type="button" class="resume" disabled={busy} onclick={() => resume(suggestion)}
            >Reprendre : {LEG_MODE_INFO[suggestion.mode].label}
            {formatDuration(suggestion.durationMin)}</button
          >
        {/if}
      {:else}
        <span class="hint">trajet</span>
      {/if}
    </div>
  {:else}
    <!-- Trajet facultatif : en lecture seule, la ligne continue simplement. -->
    <div class="top"></div>
    <span class="node empty" aria-hidden="true"></span>
    <div class="bottom"></div>
  {/if}
</div>

<style>
  /* Mêmes hauteurs de tête et de nœud que les stations : la ligne passe au centre du rond. */
  .leg {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 84px;
    text-align: center;
  }

  .leg.open {
    width: 96px;
  }

  .top {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    height: var(--metro-top);
    padding-bottom: var(--space-1);
  }

  .duration {
    font: 700 13px var(--font-mono);
    color: var(--fg);
  }

  .node {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    margin: calc((var(--metro-node) - 26px) / 2) 0;
    border: 2px solid var(--surface);
    border-radius: 50%;
    background: color-mix(in srgb, var(--c) var(--leg-icon-tint), var(--surface));
    color: color-mix(in srgb, var(--c) var(--leg-icon-ink), var(--surface));
    box-shadow: 0 0 0 1.5px var(--c);
    cursor: pointer;
  }

  .node:disabled {
    cursor: default;
  }

  .highlighted .node,
  .node:hover:not(:disabled) {
    box-shadow:
      0 0 0 1.5px var(--c),
      0 0 0 5px color-mix(in srgb, var(--c) 25%, transparent);
  }

  .node.add {
    --c: var(--accent);
    border: 1.5px dashed var(--accent);
    background: var(--surface);
    color: var(--accent-strong);
    box-shadow: none;
  }

  .node.add[aria-expanded='true'] {
    background: var(--accent);
    color: var(--on-accent);
  }

  /* Sans trajet en lecture seule : la ligne passe, sans rond. */
  .node.empty {
    visibility: hidden;
  }

  .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding-top: var(--space-1);
  }

  .mode {
    font: 600 11px var(--font-display);
    color: var(--fg);
  }

  .km {
    font: 500 10.5px var(--font-mono);
    color: var(--muted);
  }

  .source {
    padding: 0 5px;
    border-radius: var(--radius-pill);
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-size: 9.5px;
  }

  .source.manual {
    background: var(--warn-soft);
    color: var(--warn);
  }

  .hint {
    font-size: 10.5px;
    color: var(--muted);
  }

  .modes {
    display: grid;
    grid-template-columns: repeat(2, 30px);
    gap: 3px;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: var(--shadow-float);
  }

  .modes button {
    display: grid;
    place-items: center;
    height: 26px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--fg);
    cursor: pointer;
  }

  .modes button:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .resume {
    margin-top: var(--space-1);
    padding: 2px var(--space-2);
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--warn-soft);
    color: var(--warn);
    font: 600 10.5px var(--font-body);
    cursor: pointer;
  }
</style>
