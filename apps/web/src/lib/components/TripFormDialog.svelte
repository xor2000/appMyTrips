<script module lang="ts">
  export interface TripFormValues {
    name: string;
    startDate: string;
    endDate: string;
    defaultTimezone?: string;
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';

  interface Props {
    /** Valeurs actuelles en modification ; absent en création. */
    initial?: { name: string; startDate: string; endDate: string };
    onSubmit: (values: TripFormValues) => Promise<void>;
    onClose: () => void;
  }

  let { initial, onSubmit, onClose }: Props = $props();

  // Valeurs de départ du formulaire, lues une seule fois à l'ouverture.
  const start = untrack(() => initial);
  const editing = start !== undefined;
  let name = $state(start?.name ?? '');
  let startDate = $state(start?.startDate ?? '');
  let endDate = $state(start?.endDate ?? '');
  let error = $state<string | null>(null);
  let busy = $state(false);

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
</style>
