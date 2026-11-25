<script lang="ts">
  import {
    POI_CATEGORIES,
    POI_CATEGORY_INFO,
    type Poi,
    type PoiCategory,
    type WikiSummary,
  } from '@mytrips/core';
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import ZoomIn from 'lucide-svelte/icons/zoom-in';
  import { plural } from '#lib/format.ts';
  import { groupPoisByCategory, poiCounts } from '#lib/poi/explore.ts';
  import { STEP_ICONS } from '#lib/steps/icons.ts';
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
    dayLabel: string | null;
    canEdit: boolean;
    /** Références OSM des étapes du voyage (lieux déjà ajoutés). */
    addedRefs: Set<string>;
    selectedId: string | null;
    onToggleCategory: (category: PoiCategory) => void;
    /** « Tous » : toutes les catégories d'un coup (une seule recherche), ou aucune. */
    onSetCategories: (categories: PoiCategory[]) => void;
    onSearch: () => void;
    onAdd: (poi: Poi, toDay: boolean) => Promise<void>;
    onSelect: (poi: Poi) => void;
    onHover: (id: string | null) => void;
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
    dayLabel,
    canEdit,
    addedRefs,
    selectedId,
    onToggleCategory,
    onSetCategories,
    onSearch,
    onAdd,
    onSelect,
    onHover,
    onBack,
    loadWiki,
  }: Props = $props();

  const counts = $derived(poiCounts(pois));
  const groups = $derived(groupPoisByCategory(pois));
  const allOn = $derived(POI_CATEGORIES.every((c) => categories.includes(c)));
</script>

<section class="explore" aria-label="Explorer">
  <div class="head">
    <button type="button" class="btn btn-ghost back" onclick={onBack}>
      <ArrowLeft size={16} />Retour au jour
    </button>
    <h2>Explorer la zone</h2>
  </div>

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
    <!-- Groupés par catégorie : un titre (icône, libellé, nombre) et un filet, puis la liste des
         lieux de la catégorie, nommée par son titre. -->
    <div class="results" role="group" aria-label="Lieux trouvés">
      {#each groups as group (group.category)}
        {@const info = POI_CATEGORY_INFO[group.category]}
        {@const Icon = STEP_ICONS[info.stepType]}
        <section class="group">
          <h3 id={`poi-group-${group.category}`}>
            <Icon size={14} aria-hidden="true" />{info.label}
            <span class="group-count"
              >{group.pois.length}<span class="visually-hidden"
                >{group.pois.length > 1 ? ' lieux' : ' lieu'}</span
              ></span
            >
          </h3>
          <ul class="list" aria-labelledby={`poi-group-${group.category}`}>
            {#each group.pois as poi (poi.id)}
              <PoiCard
                {poi}
                selected={poi.id === selectedId}
                added={poi.osmRef !== null && addedRefs.has(poi.osmRef)}
                {dayLabel}
                {canEdit}
                {onAdd}
                {onSelect}
                {onHover}
                {loadWiki}
              />
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</section>

<style>
  .explore {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .head h2 {
    font-size: 20px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

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

  /* Groupes de résultats : titre (petite icône, libellé, nombre) avec un filet, puis la liste. */
  .results {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .group h3 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font: 700 12px var(--font-display);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .group-count {
    margin-left: auto;
    font-weight: 600;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
