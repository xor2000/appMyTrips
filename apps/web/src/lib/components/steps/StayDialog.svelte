<script module lang="ts">
  export interface StayValues {
    name: string;
    lat: number;
    lng: number;
    address: string | null;
    checkInDate: string;
    checkInTime: string;
    checkOutDate: string;
    checkOutTime: string;
    bookingRef: string | null;
  }
</script>

<script lang="ts">
  import type { Place, Stay } from '@mytrips/core';
  import { untrack } from 'svelte';
  import Modal from '../Modal.svelte';
  import PlaceSearch from './PlaceSearch.svelte';

  interface Props {
    /** Séjour existant (modification), ou absent (création). */
    stay?: Stay;
    /** Date d'arrivée proposée en création (jour affiché). */
    defaultDate: string;
    search: (q: string) => Promise<Place[]>;
    onSave: (values: StayValues) => Promise<void>;
    onDelete?: () => void;
    onClose: () => void;
  }

  let { stay, defaultDate, search, onSave, onDelete, onClose }: Props = $props();

  const nextDay = (date: string) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

  const start = untrack(() => ({ stay, defaultDate }));
  let place = $state<{ name: string; lat: number; lng: number; address: string | null } | null>(
    start.stay
      ? {
          name: start.stay.name,
          lat: start.stay.lat,
          lng: start.stay.lng,
          address: start.stay.address,
        }
      : null,
  );
  let checkInDate = $state(start.stay?.checkInDate ?? start.defaultDate);
  let checkInTime = $state(start.stay?.checkInTime ?? '17:00');
  let checkOutDate = $state(start.stay?.checkOutDate ?? nextDay(start.defaultDate));
  let checkOutTime = $state(start.stay?.checkOutTime ?? '10:00');
  let bookingRef = $state(start.stay?.bookingRef ?? '');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!place) {
      error = 'Choisissez l’hébergement.';
      return;
    }
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      error = 'Le départ doit être au moins le lendemain de l’arrivée.';
      return;
    }
    busy = true;
    error = null;
    try {
      await onSave({
        ...place,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        bookingRef: bookingRef.trim() || null,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title={stay ? 'Modifier le séjour' : 'Nouveau séjour'} {onClose}>
  {#if place}
    <div class="chosen">
      <span class="name">{place.name}</span>
      {#if place.address}<span class="address">{place.address}</span>{/if}
      <button type="button" class="btn btn-ghost change" onclick={() => (place = null)}
        >Changer</button
      >
    </div>
  {:else}
    <PlaceSearch
      {search}
      placeholder="Hôtel, gîte, adresse…"
      onPick={(p) => (place = { name: p.name, lat: p.lat, lng: p.lng, address: p.address })}
    />
  {/if}
  <form id="stay-form" class="form" onsubmit={submit} novalidate>
    <div class="row">
      <label class="field">
        Arrivée le
        <input type="date" bind:value={checkInDate} />
      </label>
      <label class="field">
        à
        <input type="time" bind:value={checkInTime} />
      </label>
    </div>
    <div class="row">
      <label class="field">
        Départ le
        <input type="date" bind:value={checkOutDate} min={checkInDate} />
      </label>
      <label class="field">
        à
        <input type="time" bind:value={checkOutTime} />
      </label>
    </div>
    <label class="field">
      N° de réservation
      <input type="text" bind:value={bookingRef} maxlength="200" />
    </label>
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
  </form>

  {#snippet actions()}
    {#if onDelete}
      <button type="button" class="btn btn-ghost danger" onclick={onDelete}>Supprimer</button>
      <span class="spacer"></span>
    {/if}
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
    <button type="submit" form="stay-form" class="btn btn-primary" disabled={busy}>
      {stay ? 'Enregistrer' : 'Ajouter le séjour'}
    </button>
  {/snippet}
</Modal>

<style>
  .chosen {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--type-hotel) 10%, var(--surface));
  }

  .name {
    font: 700 15px var(--font-display);
  }

  .address {
    flex-basis: 100%;
    order: 3;
    font-size: 13px;
    color: var(--muted);
  }

  .change {
    margin-left: auto;
    min-height: 28px;
    font-size: 13px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-3);
  }

  .danger {
    color: var(--bad);
  }

  .spacer {
    flex: 1;
  }
</style>
