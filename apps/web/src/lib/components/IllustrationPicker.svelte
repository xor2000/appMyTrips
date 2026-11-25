<script lang="ts">
  import { ILLUSTRATIONS, type IllustrationId } from '@mytrips/core';
  import { untrack } from 'svelte';
  import Illustration from '#lib/illustrations/Illustration.svelte';

  interface Props {
    /** Illustration choisie (null : automatique). */
    selected: IllustrationId | null;
    /** Illustration suggérée par le nom et les lieux, montrée sur le choix « Automatique ». */
    suggestion: IllustrationId | null;
    onSelect: (id: IllustrationId | null) => void;
  }

  let { selected, suggestion, onSelect }: Props = $props();

  let chosen = $state<IllustrationId | null>(untrack(() => selected));

  function choose(id: IllustrationId | null) {
    chosen = id;
    onSelect(id);
  }
</script>

<!-- Choix exclusif en grille de vignettes (`.cat-grid`), comme la catégorie d'un lieu. -->
<fieldset class="field picker">
  <legend class="visually-hidden">Illustration</legend>
  <div class="cat-grid">
    <label style="--c: var(--accent)">
      <input
        class="visually-hidden"
        type="radio"
        name="trip-illustration"
        checked={chosen === null}
        onchange={() => choose(null)}
      />
      {#if suggestion}
        <Illustration id={suggestion} variant="scene" decorative />
      {:else}
        <span class="none" aria-hidden="true"></span>
      {/if}
      <span>Automatique</span>
    </label>
    {#each ILLUSTRATIONS as item (item.id)}
      <label style="--c: var(--accent)">
        <input
          class="visually-hidden"
          type="radio"
          name="trip-illustration"
          checked={chosen === item.id}
          onchange={() => choose(item.id)}
        />
        <Illustration id={item.id} variant="scene" decorative />
        <span>{item.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .picker {
    margin: 0;
    padding: 0;
    border: 0;
  }

  .picker :global(.illu.scene),
  .none {
    width: 100%;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .none {
    display: block;
    aspect-ratio: 16 / 10;
    background: var(--surface-2);
  }
</style>
