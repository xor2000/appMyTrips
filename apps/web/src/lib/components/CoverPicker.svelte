<script lang="ts">
  import type { TripCover } from '@mytrips/core';
  import { onMount, untrack } from 'svelte';

  interface Props {
    /** Mots-clés de la première recherche. */
    query: string;
    /** Photo actuelle du voyage (null : aucune). */
    selected: TripCover | null;
    search: (query: string) => Promise<TripCover[]>;
    onSelect: (cover: TripCover | null) => void;
  }

  let { query, selected, search, onSelect }: Props = $props();

  let q = $state(untrack(() => query));
  let chosen = $state<TripCover | null>(untrack(() => selected));
  /** Photo du voyage à l'ouverture, toujours proposée même si la recherche ne la renvoie pas. */
  const current = untrack(() => selected);
  let results = $state<TripCover[]>([]);
  let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let searched = $state('');

  async function run() {
    const terms = q.trim();
    if (!terms) return;
    status = 'loading';
    searched = terms;
    try {
      results = await search(terms);
      status = 'ready';
    } catch {
      results = [];
      status = 'error';
    }
  }

  onMount(() => {
    run();
  });

  function choose(cover: TripCover | null) {
    chosen = cover;
    onSelect(cover);
  }

  /** Touche Entrée dans le champ : pas de formulaire imbriqué (on est dans celui du voyage). */
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    run();
  }

  /** Numérotation stable : celle de la recherche ; la photo actuelle n'est ajoutée que si elle manque. */
  const proposals = $derived(results);
  const currentMissing = $derived(current !== null && !results.some((r) => r.url === current.url));
</script>

<div class="picker">
  <div class="search">
    <label class="field">
      Rechercher une photo
      <input type="search" bind:value={q} onkeydown={onKeydown} maxlength="100" />
    </label>
    <button type="button" class="btn btn-soft" onclick={run} disabled={status === 'loading'}>
      Chercher
    </button>
  </div>

  {#if status === 'loading'}
    <p class="muted" role="status">Recherche de photos…</p>
  {:else if status === 'error'}
    <p class="form-error" role="alert">Recherche de photos indisponible. Réessaie plus tard.</p>
  {:else if status === 'ready' && proposals.length === 0}
    <p class="muted">Aucune photo trouvée pour « {searched} ».</p>
  {/if}

  <div class="options" role="radiogroup" aria-label="Photos proposées">
    {#if current && currentMissing}
      <label class="option" class:checked={chosen?.url === current.url}>
        <input
          type="radio"
          name="cover"
          checked={chosen?.url === current.url}
          aria-label={`Photo actuelle : ${current.author}`}
          onchange={() => choose(current)}
        />
        <img src={current.thumbUrl} alt="" loading="lazy" />
      </label>
    {/if}
    {#each proposals as cover, i (cover.url)}
      <label class="option" class:checked={chosen?.url === cover.url}>
        <input
          type="radio"
          name="cover"
          checked={chosen?.url === cover.url}
          aria-label={`Photo ${i + 1} : ${cover.author}`}
          onchange={() => choose(cover)}
        />
        <img src={cover.thumbUrl} alt="" loading="lazy" />
      </label>
    {/each}
    <label class="option none" class:checked={chosen === null}>
      <input
        type="radio"
        name="cover"
        checked={chosen === null}
        aria-label="Sans photo"
        onchange={() => choose(null)}
      />
      <span aria-hidden="true">Sans photo</span>
    </label>
  </div>

  {#if chosen}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- lien externe (crédit Commons) -->
    <a class="credit" href={chosen.sourceUrl} target="_blank" rel="noopener noreferrer"
      >Photo : {chosen.author} · {chosen.license} · Wikimedia Commons</a
    >
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .search {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .search .field {
    flex: 1;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--space-2);
  }

  /* Le radio invisible couvre toute la vignette : il reçoit le clic (et reste actionnable en e2e). */
  .option {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 10;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--surface-2);
    cursor: pointer;
  }

  .option input {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .option img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .option.checked {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  .option:focus-within {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .none span {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }

  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .credit {
    font-size: 12px;
    color: var(--muted);
  }
</style>
