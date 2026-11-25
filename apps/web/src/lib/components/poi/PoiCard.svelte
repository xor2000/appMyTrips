<script lang="ts">
  import { POI_CATEGORY_INFO, wikiRef, type Poi, type WikiSummary } from '@mytrips/core';
  import ResultRow from '#lib/components/places/ResultRow.svelte';
  import type { MenuPoint } from '#lib/steps/contextMenu.ts';

  interface Props {
    poi: Poi;
    selected: boolean;
    added: boolean;
    onSelect: (poi: Poi) => void;
    onContextMenu: (poi: Poi, point: MenuPoint) => void;
    loadWiki: (ref: string) => Promise<WikiSummary | null>;
  }

  let { poi, selected, added, onSelect, onContextMenu, loadWiki }: Props = $props();

  const ref = $derived(wikiRef(poi));
  let wiki = $state<{ ref: string; summary: WikiSummary | null } | 'loading' | 'error' | null>(
    null,
  );

  // Résumé Wikipédia chargé à la première sélection du lieu.
  $effect(() => {
    if (!selected || !ref || wiki !== null) return;
    const current = ref;
    wiki = 'loading';
    loadWiki(current)
      .then((summary) => (wiki = { ref: current, summary }))
      .catch(() => (wiki = 'error'));
  });
</script>

<!-- Ligne commune des résultats (sans bouton d'action), dépliée sur le détail du lieu choisi. -->
<ResultRow
  name={poi.name}
  type={poi.stepType}
  meta={`${POI_CATEGORY_INFO[poi.category].label}${poi.address ? ` · ${poi.address}` : ''}`}
  {selected}
  {added}
  expanded={selected}
  data-poi-id={poi.id}
  onSelect={() => onSelect(poi)}
  onContextMenu={(at) => onContextMenu(poi, at)}
>
  {#if selected}
    <div class="detail">
      {#if wiki === 'loading'}
        <p class="muted">Chargement du résumé…</p>
      {:else if wiki === 'error'}
        <p class="muted">Résumé Wikipédia indisponible.</p>
      {:else if wiki?.summary}
        <div class="wiki">
          {#if wiki.summary.thumbnail}
            <img src={wiki.summary.thumbnail} alt={poi.name} loading="lazy" />
          {/if}
          <p>{wiki.summary.extract}</p>
        </div>
        <!-- Lien externe (Wikipédia) : resolve() ne s'applique qu'aux routes de l'appli. -->
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={wiki.summary.url} target="_blank" rel="noopener noreferrer">Lire sur Wikipédia</a>
      {/if}
      <dl>
        {#if poi.openingHours}
          <dt>Horaires</dt>
          <dd class="mono">{poi.openingHours}</dd>
        {/if}
        {#if poi.phone}
          <dt>Téléphone</dt>
          <dd>{poi.phone}</dd>
        {/if}
        {#if poi.website}
          <dt>Site</dt>
          <dd>
            <!-- Lien externe, déjà restreint à http(s) par core (httpUrlOrNull). -->
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={poi.website} target="_blank" rel="noopener noreferrer">{poi.website}</a>
          </dd>
        {/if}
      </dl>
    </div>
  {/if}
</ResultRow>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-3) var(--space-3);
    font-size: 13px;
  }

  .wiki {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
  }

  .wiki img {
    flex: none;
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: var(--radius-md);
  }

  .wiki p {
    margin: 0;
    line-height: 1.45;
  }

  .muted {
    margin: 0;
    color: var(--muted);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px var(--space-3);
    margin: 0;
  }

  dt {
    color: var(--muted);
    font-weight: 600;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  a {
    color: var(--accent-strong);
  }
</style>
