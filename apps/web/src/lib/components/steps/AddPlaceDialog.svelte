<script lang="ts">
  import { STEP_TYPE_INFO, type Place, type StepType } from '@mytrips/core';
  import Modal from '../Modal.svelte';
  import PlaceSearch from './PlaceSearch.svelte';

  interface Props {
    title: string;
    search: (q: string) => Promise<Place[]>;
    /** Type imposé au lieu choisi ; null = type deviné par le géocodage. */
    initialType?: StepType | null;
    onPick: (place: Place, type: StepType) => Promise<void>;
    onClose: () => void;
  }

  let { title, search, initialType = null, onPick, onClose }: Props = $props();

  const QUICK_TYPES: StepType[] = [
    'restaurant',
    'museum',
    'monument',
    'attraction',
    'viewpoint',
    'airport',
    'station',
  ];

  // Type imposé : celui proposé à l'ouverture, modifiable ensuite par les pastilles.
  let forcedType = $derived<StepType | null>(initialType);
  let error = $state<string | null>(null);

  async function pick(place: Place) {
    error = null;
    try {
      await onPick(place, forcedType ?? place.type);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<Modal {title} {onClose}>
  <div class="types" role="group" aria-label="Type de lieu">
    <button
      type="button"
      class="chip"
      aria-pressed={forcedType === null}
      onclick={() => (forcedType = null)}
    >
      Automatique
    </button>
    {#each QUICK_TYPES as t (t)}
      <button
        type="button"
        class="chip"
        aria-pressed={forcedType === t}
        style={`--c: var(${STEP_TYPE_INFO[t].color})`}
        onclick={() => (forcedType = t)}>{STEP_TYPE_INFO[t].label}</button
      >
    {/each}
  </div>
  <PlaceSearch {search} onPick={pick} />
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onClose}>Fermer</button>
  {/snippet}
</Modal>

<style>
  .types {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .types .chip {
    border: 0;
    background: var(--surface-2);
    color: var(--fg);
    cursor: pointer;
  }

  .types .chip[aria-pressed='true'] {
    background: var(--c, var(--accent));
    color: #fff;
  }
</style>
