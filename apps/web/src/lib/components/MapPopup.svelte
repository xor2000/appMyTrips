<script lang="ts">
  import Check from 'lucide-svelte/icons/check';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Plus from 'lucide-svelte/icons/plus';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import type { MapPopupContent } from '#lib/map/popups.ts';

  interface Props {
    content: MapPopupContent;
  }

  let { content }: Props = $props();

  const ICONS = { edit: Pencil, trash: Trash2, plus: Plus };
</script>

<!-- Popup de la carte, comme la maquette de référence : catégorie, nom, notes, infos, actions. -->
<div
  class="map-popup-body"
  data-testid={`${content.kind}-popup`}
  style={`--pc: var(${content.color})`}
>
  <div class="cat">{content.category}</div>
  <h4>{content.title}</h4>
  {#if content.notes}
    <p class="notes">{content.notes}</p>
  {/if}
  {#if content.meta.length > 0 || content.chip}
    <div class="meta">
      {#if content.meta.length > 0}<span>{content.meta.join(' · ')}</span>{/if}
      {#if content.chip}
        <span class="chip" class:check={content.chip.check}>
          {#if content.chip.check}<Check size={12} aria-hidden="true" />{/if}{content.chip.label}
        </span>
      {/if}
    </div>
  {/if}
  {#if content.actions.length > 0}
    <div class="actions">
      {#each content.actions as action (action.label)}
        {@const Icon = ICONS[action.icon]}
        <button
          type="button"
          class={action.primary ? 'btn btn-primary' : 'btn btn-ghost'}
          onclick={action.run}
        >
          <Icon size={14} aria-hidden="true" />{action.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .map-popup-body {
    min-width: 200px;
    max-width: 260px;
    line-height: 1.35;
  }

  .cat {
    padding-right: 22px;
    color: var(--pc, var(--accent));
    font: 800 10.5px var(--font-display);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  h4 {
    margin: 1px 0 0;
    color: var(--fg);
    font: 800 15px var(--font-display);
    letter-spacing: -0.01em;
  }

  .notes {
    margin: 7px 0 0;
    color: var(--muted);
    font-size: 12.5px;
    white-space: pre-wrap;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
  }

  .chip.check {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }

  .actions .btn {
    flex: 1;
    justify-content: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
    white-space: nowrap;
  }
</style>
