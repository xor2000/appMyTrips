<script lang="ts">
  import { STEP_TYPES, STEP_TYPE_INFO, type Day, type Step, type StepPatch } from '@mytrips/core';
  import { untrack } from 'svelte';
  import { dayTitle } from '#lib/format.ts';
  import Modal from '../Modal.svelte';

  interface Props {
    step: Step;
    days: Day[];
    onSave: (patch: StepPatch) => Promise<void>;
    onDelete: () => void;
    onClose: () => void;
  }

  let { step, days, onSave, onDelete, onClose }: Props = $props();

  // Valeurs de départ, lues une seule fois à l'ouverture.
  const start = untrack(() => step);
  const isGroup = start.kind === 'group';

  let name = $state(start.name);
  let type = $state(start.type ?? 'other');
  let durationMin = $state(start.durationMin);
  let hasFixed = $state(start.fixedStart !== null);
  let fixedStart = $state(start.fixedStart ?? '09:00');
  let bookingRef = $state(start.bookingRef ?? '');
  let bookingUrl = $state(start.bookingUrl ?? '');
  let notes = $state(start.notes);
  /** '' = liste d'idées. */
  let dayId = $state(start.dayId ?? '');
  let error = $state<string | null>(null);
  let busy = $state(false);

  const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = 'Le nom est obligatoire.';
      return;
    }
    if (bookingUrl.trim() && !/^https?:\/\/[^\s/?#]+\S*$/i.test(bookingUrl.trim())) {
      error = 'Le lien de réservation doit commencer par http:// ou https://.';
      return;
    }
    const patch: StepPatch = {};
    if (name.trim() !== start.name) patch.name = name.trim();
    if (notes !== start.notes) patch.notes = notes;
    const nextDay = dayId === '' ? null : dayId;
    if (nextDay !== start.dayId) patch.dayId = nextDay;
    if (!isGroup) {
      if (type !== start.type) patch.type = type;
      if (durationMin !== start.durationMin) patch.durationMin = durationMin;
      const fixed = hasFixed ? fixedStart : null;
      if (fixed !== start.fixedStart) patch.fixedStart = fixed;
      if (orNull(bookingRef) !== start.bookingRef) patch.bookingRef = orNull(bookingRef);
      if (orNull(bookingUrl) !== start.bookingUrl) patch.bookingUrl = orNull(bookingUrl);
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    error = null;
    busy = true;
    try {
      await onSave(patch);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title={isGroup ? 'Modifier le dossier' : 'Modifier l’étape'} {onClose}>
  <form id="step-form" class="form" onsubmit={submit} novalidate>
    <label class="field">
      Nom
      <input type="text" bind:value={name} maxlength="200" />
    </label>
    {#if !isGroup}
      {#if start.address}
        <p class="address">{start.address}</p>
      {/if}
      <div class="row">
        <label class="field">
          Type
          <select bind:value={type}>
            {#each STEP_TYPES as t (t)}
              <option value={t}>{STEP_TYPE_INFO[t].label}</option>
            {/each}
          </select>
        </label>
        <label class="field">
          Durée sur place (min)
          <input type="number" min="0" max="1440" step="5" bind:value={durationMin} />
        </label>
      </div>
      <div class="row fixed">
        <label class="check">
          <input type="checkbox" bind:checked={hasFixed} />
          Heure fixe
        </label>
        <label class="field" class:disabled={!hasFixed}>
          Heure
          <input type="time" bind:value={fixedStart} disabled={!hasFixed} />
        </label>
      </div>
      <div class="row">
        <label class="field">
          N° de réservation
          <input type="text" bind:value={bookingRef} maxlength="200" />
        </label>
        <label class="field">
          Lien de réservation
          <input type="url" bind:value={bookingUrl} placeholder="https://…" />
        </label>
      </div>
    {/if}
    <label class="field">
      Jour
      <select bind:value={dayId}>
        {#each days as d, i (d.id)}
          <option value={d.id}>J{i + 1} · {dayTitle(d.date)}</option>
        {/each}
        <option value="">Idées (pas encore placé)</option>
      </select>
    </label>
    <label class="field">
      Notes
      <textarea rows="3" bind:value={notes} maxlength="5000"></textarea>
    </label>
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost danger" onclick={onDelete}>Supprimer</button>
    <span class="spacer"></span>
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
    <button type="submit" form="step-form" class="btn btn-primary" disabled={busy}
      >Enregistrer</button
    >
  {/snippet}
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .fixed {
    align-items: end;
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    font-size: 14px;
    font-weight: 600;
  }

  .disabled {
    opacity: 0.5;
  }

  .address {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  textarea {
    padding: var(--space-2) var(--space-3);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--fg);
    font: 500 14px var(--font-body);
    resize: vertical;
  }

  .danger {
    color: var(--bad);
  }

  .spacer {
    flex: 1;
  }
</style>
