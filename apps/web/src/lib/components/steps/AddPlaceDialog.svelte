<script lang="ts">
  import { STEP_TYPE_INFO, type Place, type StepType } from '@mytrips/core';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import { STEP_ICONS } from '#lib/steps/icons.ts';
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

  // Type imposé : celui proposé à l'ouverture, modifiable ensuite dans la grille.
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

<Modal {title} subtitle="Recherchez le lieu, puis choisissez-le dans la liste." {onClose}>
  <!-- Catégorie en grille de boutons icône et libellé (`.cat-grid` de la maquette). -->
  <fieldset class="field ref">
    <legend>Catégorie</legend>
    <div class="cat-grid">
      <label style="--c: var(--accent)">
        <input
          class="visually-hidden"
          type="radio"
          name="add-type"
          value={null}
          bind:group={forcedType}
        />
        <Sparkles size={18} aria-hidden="true" />
        <span>Automatique</span>
      </label>
      {#each QUICK_TYPES as t (t)}
        {@const Icon = STEP_ICONS[t]}
        <label style={`--c: var(${STEP_TYPE_INFO[t].color})`}>
          <input
            class="visually-hidden"
            type="radio"
            name="add-type"
            value={t}
            bind:group={forcedType}
          />
          <Icon size={18} aria-hidden="true" />
          <span>{STEP_TYPE_INFO[t].label}</span>
        </label>
      {/each}
    </div>
  </fieldset>
  <PlaceSearch {search} onPick={pick} autofocus />
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
  {/snippet}
</Modal>
