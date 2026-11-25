<script module lang="ts">
  /** Façon de choisir le lieu : recherche, clic sur la carte, coordonnées GPS. */
  export type NewPlaceTab = 'search' | 'map' | 'coords';
</script>

<script lang="ts">
  import type { Place } from '@mytrips/core';
  import { onDestroy, untrack } from 'svelte';
  import Crosshair from 'lucide-svelte/icons/crosshair';
  import MapPin from 'lucide-svelte/icons/map-pin';
  import Search from 'lucide-svelte/icons/search';
  import { parseLatLng } from '#lib/steps/coords.ts';
  import Modal from '../Modal.svelte';
  import PlaceSearch from './PlaceSearch.svelte';

  interface Props {
    search: (q: string) => Promise<Place[]>;
    /** Lieu le plus proche d'un point (géocodage inverse, jamais en échec). */
    locate: (point: { lat: number; lng: number }) => Promise<Place>;
    /**
     * Choix d'un point sur la carte (fenêtre masquée pendant le choix), null si abandon ; absent
     * quand la carte n'est pas affichée (plein écran) : pas d'onglet « Sur la carte ».
     */
    onPickOnMap?: () => Promise<{ lat: number; lng: number } | null>;
    /** Lieu choisi : la fenêtre « Nouveau lieu » prend le relais. */
    onChoose: (place: Place) => void;
    onClose: () => void;
    initialTab?: NewPlaceTab;
  }

  let { search, locate, onPickOnMap, onChoose, onClose, initialTab = 'search' }: Props = $props();

  const TABS = $derived(
    [
      { id: 'search', label: 'Rechercher', icon: Search },
      { id: 'map', label: 'Sur la carte', icon: MapPin },
      { id: 'coords', label: 'Coordonnées', icon: Crosshair },
    ].filter((t) => t.id !== 'map' || onPickOnMap),
  );
  // Onglet « Sur la carte » absent sans carte : on retombe sur la recherche.
  let tab = $state<NewPlaceTab>(
    untrack(() => (initialTab === 'map' && !onPickOnMap ? 'search' : initialTab)),
  );
  /** Fenêtre fermée : une réponse tardive du géocodage inverse est ignorée. */
  let closed = false;
  onDestroy(() => (closed = true));
  let latText = $state('');
  let lngText = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);
  /** Fenêtre masquée pendant le choix d'un point sur la carte. */
  let picking = $state(false);

  /** Point choisi (carte ou coordonnées) : situé par le géocodage inverse, puis transmis. */
  async function usePoint(point: { lat: number; lng: number }) {
    busy = true;
    error = null;
    try {
      const place = await locate(point);
      if (!closed) onChoose(place);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function submitCoords(event: SubmitEvent) {
    event.preventDefault();
    const point = parseLatLng(latText, lngText);
    if (!point) {
      error =
        'Coordonnées invalides : latitude entre -90 et 90, longitude entre -180 et 180, en degrés décimaux (ex. 48.8584, 2.2945).';
      return;
    }
    await usePoint(point);
  }

  async function pickOnMap() {
    if (!onPickOnMap) return;
    picking = true;
    let point: { lat: number; lng: number } | null;
    try {
      point = await onPickOnMap();
    } finally {
      picking = false;
    }
    if (point) await usePoint(point);
  }
</script>

<Modal
  title="Ajouter un lieu"
  subtitle="Choisissez le lieu, puis complétez ses informations."
  hidden={picking}
  {onClose}
>
  <fieldset class="field ref">
    <legend>Choisir le lieu</legend>
    <div class="seg">
      {#each TABS as t (t.id)}
        {@const Icon = t.icon}
        <label>
          <input
            class="visually-hidden"
            type="radio"
            name="new-place-tab"
            value={t.id}
            bind:group={tab}
            onchange={() => (error = null)}
          />
          <Icon size={16} aria-hidden="true" />
          <span>{t.label}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  {#if tab === 'search'}
    <PlaceSearch {search} onPick={onChoose} autofocus />
  {:else if tab === 'map'}
    <p class="hint">Cliquez sur la carte à l’endroit du lieu ; Échap pour annuler.</p>
    <button type="button" class="btn btn-soft pick" disabled={busy} onclick={pickOnMap}>
      <MapPin size={15} aria-hidden="true" />Choisir sur la carte
    </button>
  {:else}
    <form id="coords-form" class="coords" onsubmit={submitCoords} novalidate>
      <div class="field-row">
        <label class="field ref">
          Latitude
          <input
            type="text"
            inputmode="decimal"
            placeholder="48.8584 (ou « 48.8584, 2.2945 »)"
            bind:value={latText}
            data-autofocus
          />
        </label>
        <label class="field ref">
          Longitude
          <input type="text" inputmode="decimal" placeholder="2.2945" bind:value={lngText} />
        </label>
      </div>
      <button type="submit" class="btn btn-soft use" disabled={busy}>Utiliser ce point</button>
    </form>
  {/if}
  {#if busy}
    <p class="hint" role="status">Recherche du lieu…</p>
  {/if}
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
  {/snippet}
</Modal>

<style>
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .pick,
  .use {
    align-self: flex-start;
  }

  .coords {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
