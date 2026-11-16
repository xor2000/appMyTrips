<script lang="ts">
  import { STEP_TYPE_INFO, type Place } from '@mytrips/core';
  import Search from 'lucide-svelte/icons/search';
  import { onDestroy } from 'svelte';

  interface Props {
    search: (q: string) => Promise<Place[]>;
    onPick: (place: Place) => void;
    /** Délai avant la recherche, en millisecondes (anti-rebond). */
    delay?: number;
    placeholder?: string;
  }

  let {
    search,
    onPick,
    delay = 300,
    placeholder = 'Musée, restaurant, adresse…',
  }: Props = $props();

  let query = $state('');
  let results = $state<Place[] | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Numéro de la dernière requête : une réponse plus ancienne est ignorée. */
  let requestId = 0;

  function onInput() {
    clearTimeout(timer);
    const q = query.trim();
    if (q.length < 2) {
      results = null;
      error = null;
      return;
    }
    timer = setTimeout(() => run(q), delay);
  }

  async function run(q: string) {
    const id = ++requestId;
    loading = true;
    try {
      const found = await search(q);
      if (id !== requestId) return;
      results = found;
      error = null;
    } catch (e) {
      if (id !== requestId) return;
      results = null;
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (id === requestId) loading = false;
    }
  }

  onDestroy(() => clearTimeout(timer));
</script>

<div class="search">
  <label class="input">
    <Search size={16} />
    <input
      type="search"
      aria-label="Rechercher un lieu"
      bind:value={query}
      oninput={onInput}
      {placeholder}
      autocomplete="off"
    />
  </label>
  {#if loading}
    <p class="hint">Recherche…</p>
  {/if}
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if results && results.length === 0}
    <p class="hint">Aucun lieu trouvé.</p>
  {:else if results}
    <ul class="results">
      {#each results as place (`${place.osmRef}-${place.lat}-${place.lng}`)}
        <li>
          <button type="button" onclick={() => onPick(place)}>
            <span class="name">{place.name}</span>
            <span class="meta">
              {STEP_TYPE_INFO[place.type].label}{place.address ? ` · ${place.address}` : ''}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .input {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--muted);
  }

  .input:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  input {
    flex: 1;
    min-height: 40px;
    border: 0;
    background: transparent;
    color: var(--fg);
    font: 500 15px var(--font-body);
    outline: none;
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 280px;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }

  .results button {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }

  .results button:hover,
  .results button:focus-visible {
    background: var(--surface-2);
  }

  .name {
    font-weight: 600;
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }
</style>
