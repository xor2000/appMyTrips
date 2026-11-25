<script lang="ts">
  import { STEP_TYPE_INFO, type StepType } from '@mytrips/core';
  import Check from 'lucide-svelte/icons/check';
  import type { Snippet } from 'svelte';
  import type { HTMLLiAttributes } from 'svelte/elements';
  import { contextMenuKey, type MenuPoint } from '#lib/steps/contextMenu.ts';
  import { STEP_ICONS } from '#lib/steps/icons.ts';

  /**
   * Ligne d'un résultat de recherche de lieux, commune à « Rechercher » et « Explorer la zone » :
   * aucun bouton d'action. Clic gauche : `onSelect` (la page centre la carte et ouvre la popup) ;
   * clic droit, touche Menu ou Maj+F10 : `onContextMenu` (menu contextuel commun).
   */
  interface Props extends Omit<HTMLLiAttributes, 'children'> {
    name: string;
    type: StepType;
    /** Ligne secondaire : type ou catégorie, puis adresse. */
    meta: string;
    selected: boolean;
    /** Lieu déjà dans le voyage (même référence OSM) : pastille « Déjà ajouté ». */
    added: boolean;
    /** Ligne dépliable (détail sous la ligne) : son état, pour `aria-expanded`. */
    expanded?: boolean;
    onSelect: () => void;
    onContextMenu: (point: MenuPoint) => void;
    /** Détail sous la ligne (résumé Wikipédia, horaires… d'un lieu découvert). */
    children?: Snippet;
  }

  let {
    name,
    type,
    meta,
    selected,
    added,
    expanded,
    onSelect,
    onContextMenu,
    children,
    ...rest
  }: Props = $props();

  const Icon = $derived(STEP_ICONS[type]);

  function onMenu(event: MouseEvent) {
    event.preventDefault();
    onContextMenu({ x: event.clientX, y: event.clientY });
  }

  function onKeydown(event: KeyboardEvent) {
    const at = contextMenuKey(event);
    if (at) onContextMenu(at);
  }
</script>

<li
  {...rest}
  class="result"
  class:selected
  aria-label={name}
  style={`--c: var(${STEP_TYPE_INFO[type].color})`}
>
  <!-- Clic droit sur la ligne seulement : dans le détail déplié, les liens gardent le menu du
       navigateur (ouvrir dans un onglet, copier le lien). -->
  <div class="row" role="presentation" oncontextmenu={onMenu}>
    <button
      type="button"
      class="main"
      aria-expanded={expanded}
      onclick={onSelect}
      onkeydown={onKeydown}
    >
      <span class="icon"><Icon size={16} /></span>
      <span class="text">
        <span class="name">{name}</span>
        <span class="meta">{meta}</span>
      </span>
    </button>
    {#if added}
      <span class="chip added"><Check size={12} />Déjà ajouté</span>
    {/if}
  </div>
  {@render children?.()}
</li>

<style>
  .result {
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    transition: box-shadow 0.15s;
  }

  .result:hover,
  .result.selected {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 60%, transparent);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-right: var(--space-3);
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
    cursor: pointer;
  }

  .icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--c) 22%, var(--surface));
    color: var(--c);
  }

  .text {
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .added {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--ok-soft);
    color: var(--ok);
    white-space: nowrap;
  }
</style>
