<script lang="ts">
  import {
    POI_CATEGORIES,
    POI_CATEGORY_INFO,
    type Poi,
    type PoiCategory,
    type WikiSummary,
  } from '@mytrips/core';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import ZoomIn from 'lucide-svelte/icons/zoom-in';
  import ResultGroups from '#lib/components/places/ResultGroups.svelte';
  import SidePanel from '#lib/components/places/SidePanel.svelte';
  import { plural } from '#lib/format.ts';
  import { poiResultGroups } from '#lib/places/results.ts';
  import { poiCounts } from '#lib/poi/explore.ts';
  import type { MenuPoint } from '#lib/steps/contextMenu.ts';
  import PoiCard from './PoiCard.svelte';

  interface Props {
    /** Catégories cochées. */
    categories: PoiCategory[];
    pois: Poi[];
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    zoomTooLow: boolean;
    /** La carte a bougé depuis la dernière recherche. */
    stale: boolean;
    /** Références OSM des étapes du voyage (lieux déjà ajoutés). */
    addedRefs: Set<string>;
    selectedId: string | null;
    onToggleCategory: (category: PoiCategory) => void;
    /** « Tous » : toutes les catégories d'un coup (une seule recherche), ou aucune. */
    onSetCategories: (categories: PoiCategory[]) => void;
    onSearch: () => void;
    onSelect: (poi: Poi) => void;
    /** Clic droit, touche Menu ou Maj+F10 sur un lieu : menu contextuel commun. */
    onContextMenu: (poi: Poi, point: MenuPoint) => void;
    onBack: () => void;
    loadWiki: (ref: string) => Promise<WikiSummary | null>;
  }

  let {
    categories,
    pois,
    status,
    error,
    zoomTooLow,
    stale,
    addedRefs,
    selectedId,
    onToggleCategory,
    onSetCategories,
    onSearch,
    onSelect,
    onContextMenu,
    onBack,
    loadWiki,
  }: Props = $props();

  const counts = $derived(poiCounts(pois));
  const groups = $derived(poiResultGroups(pois));
  const allOn = $derived(POI_CATEGORIES.every((c) => categories.includes(c)));
</script>

<SidePanel label="Explorer" title="Explorer la zone" {onBack}>
  <div class="chips" role="group" aria-label="Catégories">
    <button
      type="button"
      class="cat"
      aria-pressed={allOn}
      onclick={() => onSetCategories(allOn ? [] : [...POI_CATEGORIES])}>Tous</button
    >
    {#each POI_CATEGORIES as category (category)}
      {@const on = categories.includes(category)}
      <button
        type="button"
        class="cat"
        aria-pressed={on}
        onclick={() => onToggleCategory(category)}
      >
        {POI_CATEGORY_INFO[category].label}
        {#if on && counts.get(category) !== undefined}
          <span class="count">{counts.get(category)}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if zoomTooLow}
    <p class="hint"><ZoomIn size={16} />Zoomez pour explorer</p>
  {:else if stale && categories.length > 0}
    <button type="button" class="btn btn-soft refresh" onclick={onSearch}>
      <RefreshCw size={14} />Rechercher dans cette zone
    </button>
  {/if}

  {#if status === 'error' && error}
    <p class="form-error" role="alert">{error}</p>
  {:else if status === 'loading'}
    <p class="hint" role="status">Recherche des lieux…</p>
  {:else if categories.length === 0}
    <p class="hint">Choisissez une ou plusieurs catégories.</p>
  {:else if status === 'ready' && pois.length === 0 && !zoomTooLow}
    <p class="hint">Aucun lieu trouvé dans cette zone.</p>
  {/if}

  {#if pois.length > 0}
    <p class="total">{plural(pois.length, 'lieu', 'lieux')} dans la zone</p>
    <!-- Groupés par catégorie, comme les résultats de « Rechercher » (composants communs). -->
    <ResultGroups {groups} label="Lieux trouvés" idPrefix="poi-group" key={(poi) => poi.id}>
      {#snippet row(poi)}
        <PoiCard
          {poi}
          selected={poi.id === selectedId}
          added={poi.osmRef !== null && addedRefs.has(poi.osmRef)}
          {onSelect}
          {onContextMenu}
          {loadWiki}
        />
      {/snippet}
    </ResultGroups>
  {/if}
</SidePanel>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .cat {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--fg);
    font: 600 13px var(--font-display);
    cursor: pointer;
  }

  .cat[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }

  .hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }

  .refresh {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .total {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
