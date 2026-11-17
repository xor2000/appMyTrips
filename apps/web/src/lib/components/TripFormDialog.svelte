<script module lang="ts">
  import type { TripCover } from '@mytrips/core';

  export interface TripFormValues {
    name: string;
    startDate: string;
    endDate: string;
    defaultTimezone?: string;
    /** Nouvelle photo (présente seulement si elle a changé ; null : la retirer). */
    cover?: TripCover | null;
  }
</script>

<script lang="ts">
  import { coverQuery } from '@mytrips/core';
  import { untrack } from 'svelte';
  import CoverPicker from './CoverPicker.svelte';
  import Modal from './Modal.svelte';

  interface Props {
    /** Valeurs actuelles en modification ; absent en création. */
    initial?: { name: string; startDate: string; endDate: string };
    /** Photo actuelle (modification). */
    cover?: TripCover | null;
    /** Recherche de photos : sans elle, pas de section « Photo du voyage ». */
    searchCovers?: (query: string) => Promise<TripCover[]>;
    /** Lieux du voyage, pour les mots-clés quand le nom ne dit rien. */
    places?: string[];
    onSubmit: (values: TripFormValues) => Promise<void>;
    onClose: () => void;
  }

  let { initial, cover = null, searchCovers, places = [], onSubmit, onClose }: Props = $props();

  // Valeurs de départ du formulaire, lues une seule fois à l'ouverture.
  const start = untrack(() => initial);
  const editing = start !== undefined;
  let name = $state(start?.name ?? '');
  let startDate = $state(start?.startDate ?? '');
  let endDate = $state(start?.endDate ?? '');
  let error = $state<string | null>(null);
  let busy = $state(false);
  let picking = $state(false);
  /** Photo choisie ; `undefined` tant qu'elle n'a pas changé. */
  let chosenCover = $state<TripCover | null | undefined>(undefined);
  const shownCover = $derived(chosenCover === undefined ? cover : chosenCover);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      error = 'Donnez un nom au voyage.';
      return;
    }
    if (!startDate || !endDate) {
      error = 'Indiquez les dates de début et de fin.';
      return;
    }
    if (endDate < startDate) {
      error = 'La fin du voyage doit être après son début.';
      return;
    }
    error = null;
    busy = true;
    try {
      const values: TripFormValues = { name: trimmed, startDate, endDate };
      if (!editing) values.defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (chosenCover !== undefined) values.cover = chosenCover;
      await onSubmit(values);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title={editing ? 'Modifier le voyage' : 'Nouveau voyage'} {onClose}>
  <form id="trip-form" class="form" onsubmit={submit} novalidate>
    <label class="field">
      Nom du voyage
      <input type="text" bind:value={name} maxlength="120" placeholder="Week-end dans les Alpes" />
    </label>
    <div class="dates">
      <label class="field">
        Du
        <input type="date" bind:value={startDate} />
      </label>
      <label class="field">
        Au
        <input type="date" bind:value={endDate} min={startDate || undefined} />
      </label>
    </div>
    {#if editing && searchCovers}
      <section class="cover" aria-labelledby="cover-title">
        <div class="cover-head">
          <h3 id="cover-title">Photo du voyage</h3>
          {#if !picking}
            <button type="button" class="btn btn-soft" onclick={() => (picking = true)}>
              Changer la photo
            </button>
          {/if}
        </div>
        {#if picking}
          <CoverPicker
            query={coverQuery(name, places) || name}
            selected={cover}
            search={searchCovers}
            onSelect={(c) => (chosenCover = c)}
          />
        {:else if shownCover}
          <div class="current">
            <img src={shownCover.thumbUrl} alt="" />
            <span>Photo : {shownCover.author} · {shownCover.license}</span>
          </div>
        {:else}
          <p class="muted">Aucune photo pour l’instant.</p>
        {/if}
      </section>
    {/if}
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
    <button type="submit" form="trip-form" class="btn btn-primary" disabled={busy}>
      {editing ? 'Enregistrer' : 'Créer le voyage'}
    </button>
  {/snippet}
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .dates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .cover {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .cover-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .cover h3 {
    font-size: 14px;
  }

  .current {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: 12px;
    color: var(--muted);
  }

  .current img {
    width: 120px;
    aspect-ratio: 16 / 10;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }

  .muted {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
