<script module lang="ts">
  import type { IllustrationId } from '@mytrips/core';

  export interface TripFormValues {
    name: string;
    startDate: string;
    endDate: string;
    defaultTimezone?: string;
    /** Nouvelle illustration (présente seulement si elle a changé ; null : automatique). */
    illustration?: IllustrationId | null;
  }
</script>

<script lang="ts">
  import { illustrationLabel, suggestIllustration } from '@mytrips/core';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import { untrack } from 'svelte';
  import Illustration from '#lib/illustrations/Illustration.svelte';
  import IllustrationPicker from './IllustrationPicker.svelte';
  import Modal from './Modal.svelte';

  interface Props {
    /** Valeurs actuelles en modification ; absent en création. */
    initial?: { name: string; startDate: string; endDate: string };
    /** Illustration choisie (modification) ; null : suggérée d'après le nom et les lieux. */
    illustration?: IllustrationId | null;
    /** Lieux du voyage, pour la suggestion quand le nom ne dit rien. */
    places?: string[];
    onSubmit: (values: TripFormValues) => Promise<void>;
    onClose: () => void;
    /** Suppression du voyage (propriétaire) : bouton « Supprimer le voyage » en bas à gauche. */
    onDelete?: () => void;
  }

  let { initial, illustration = null, places = [], onSubmit, onClose, onDelete }: Props = $props();

  // Valeurs de départ du formulaire, lues une seule fois à l'ouverture.
  const start = untrack(() => initial);
  const editing = start !== undefined;
  let name = $state(start?.name ?? '');
  let startDate = $state(start?.startDate ?? '');
  let endDate = $state(start?.endDate ?? '');
  let error = $state<string | null>(null);
  let busy = $state(false);
  let picking = $state(false);
  /** Illustration choisie ; `undefined` tant qu'elle n'a pas changé. */
  let chosenIllustration = $state<IllustrationId | null | undefined>(undefined);
  const selectedIllustration = $derived(
    chosenIllustration === undefined ? illustration : chosenIllustration,
  );
  const suggestion = $derived(suggestIllustration(name, places));
  const shownIllustration = $derived(selectedIllustration ?? suggestion);

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
      if (chosenIllustration !== undefined && chosenIllustration !== illustration) {
        values.illustration = chosenIllustration;
      }
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
    {#if editing}
      <section class="illustration" aria-labelledby="illustration-title">
        <div class="illustration-head">
          <h3 id="illustration-title">Illustration du voyage</h3>
          {#if !picking}
            <button type="button" class="btn btn-soft" onclick={() => (picking = true)}>
              Changer l’illustration
            </button>
          {/if}
        </div>
        {#if picking}
          <IllustrationPicker
            selected={illustration}
            {suggestion}
            onSelect={(id) => (chosenIllustration = id)}
          />
        {:else if shownIllustration}
          <div class="current">
            <span class="preview">
              <Illustration id={shownIllustration} variant="scene" decorative />
            </span>
            <span>
              {selectedIllustration
                ? illustrationLabel(selectedIllustration)
                : `Automatique : ${illustrationLabel(shownIllustration)}`}
            </span>
          </div>
        {:else}
          <p class="muted">Automatique : aucune illustration ne correspond au nom du voyage.</p>
        {/if}
      </section>
    {/if}
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
  </form>

  {#snippet actions()}
    {#if onDelete}
      <button type="button" class="btn btn-danger-ghost" onclick={onDelete}>
        <Trash2 size={16} />Supprimer le voyage
      </button>
      <span class="spacer"></span>
    {/if}
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

  .illustration {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .illustration-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .illustration h3 {
    font-size: 14px;
  }

  .current {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: 12px;
    color: var(--muted);
  }

  .preview {
    width: 120px;
    flex: none;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .spacer {
    flex: 1;
  }

  .muted {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
