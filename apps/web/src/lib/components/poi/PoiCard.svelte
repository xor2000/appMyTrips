<script lang="ts">
  import {
    POI_CATEGORY_INFO,
    STEP_TYPE_INFO,
    wikiRef,
    type Poi,
    type WikiSummary,
  } from '@mytrips/core';
  import Check from 'lucide-svelte/icons/check';
  import { STEP_ICONS } from '#lib/steps/icons.ts';

  interface Props {
    poi: Poi;
    selected: boolean;
    added: boolean;
    /** Libellé du jour sélectionné (« J2 »), ou null en vue d'ensemble. */
    dayLabel: string | null;
    canEdit: boolean;
    onAdd: (poi: Poi, toDay: boolean) => Promise<void>;
    onSelect: (poi: Poi) => void;
    onHover: (id: string | null) => void;
    loadWiki: (ref: string) => Promise<WikiSummary | null>;
  }

  let { poi, selected, added, dayLabel, canEdit, onAdd, onSelect, onHover, loadWiki }: Props =
    $props();

  const Icon = $derived(STEP_ICONS[poi.stepType]);
  const ref = $derived(wikiRef(poi));
  let wiki = $state<{ ref: string; summary: WikiSummary | null } | 'loading' | 'error' | null>(
    null,
  );
  let busy = $state(false);

  // Résumé Wikipédia chargé à la première sélection du lieu.
  $effect(() => {
    if (!selected || !ref || wiki !== null) return;
    const current = ref;
    wiki = 'loading';
    loadWiki(current)
      .then((summary) => (wiki = { ref: current, summary }))
      .catch(() => (wiki = 'error'));
  });

  async function add(toDay: boolean) {
    busy = true;
    try {
      await onAdd(poi, toDay);
    } finally {
      busy = false;
    }
  }
</script>

<li
  class="poi"
  class:selected
  aria-label={poi.name}
  data-poi-id={poi.id}
  style={`--c: var(${STEP_TYPE_INFO[poi.stepType].color})`}
  onmouseenter={() => onHover(poi.id)}
  onmouseleave={() => onHover(null)}
>
  <div class="row">
    <button type="button" class="main" aria-expanded={selected} onclick={() => onSelect(poi)}>
      <span class="icon"><Icon size={16} /></span>
      <span class="text">
        <span class="name">{poi.name}</span>
        <span class="meta">
          {POI_CATEGORY_INFO[poi.category].label}{#if poi.address}&nbsp;· {poi.address}{/if}
        </span>
      </span>
    </button>
    {#if added}
      <span class="chip added"><Check size={12} />Déjà ajouté</span>
    {:else if canEdit}
      <div class="add">
        {#if dayLabel}
          <button
            type="button"
            class="btn btn-soft"
            disabled={busy}
            aria-label={`Ajouter ${poi.name} à ${dayLabel}`}
            onclick={() => add(true)}>+ {dayLabel}</button
          >
        {/if}
        <button
          type="button"
          class="btn btn-ghost"
          disabled={busy}
          aria-label={`Ajouter ${poi.name} aux idées`}
          onclick={() => add(false)}>+ Idées</button
        >
      </div>
    {/if}
  </div>

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
</li>

<style>
  .poi {
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    transition: box-shadow 0.15s;
  }

  .poi:hover,
  .poi.selected {
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

  .add {
    display: flex;
    gap: var(--space-1);
  }

  .add .btn {
    padding: var(--space-1) var(--space-3);
    font-size: 13px;
  }

  .added {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--ok-soft);
    color: var(--ok);
    white-space: nowrap;
  }

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
