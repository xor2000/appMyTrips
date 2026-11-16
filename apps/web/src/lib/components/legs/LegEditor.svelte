<script lang="ts">
  import { LEG_MODES, LEG_MODE_INFO, type Leg, type LegMode, type LegPatch } from '@mytrips/core';
  import { untrack } from 'svelte';
  import { legSourceLabel } from '#lib/legs/legs.ts';
  import Modal from '../Modal.svelte';

  interface Props {
    leg: Leg;
    onSave: (patch: LegPatch) => Promise<void>;
    /** Revenir aux valeurs du routeur. */
    onRecompute: () => Promise<void>;
    onDelete: () => void;
    onClose: () => void;
    /** Saisie manuelle d'un trajet qui n'existe pas encore (aucun itinéraire trouvé). */
    isNew?: boolean;
    /** Message affiché en tête (ex. aucun itinéraire). */
    message?: string | null;
  }

  let {
    leg,
    onSave,
    onRecompute,
    onDelete,
    onClose,
    isNew = false,
    message = null,
  }: Props = $props();

  // Valeurs de départ, lues une seule fois à l'ouverture.
  const start = untrack(() => leg);
  const startKm = start.distanceM === null ? '' : String(Math.round(start.distanceM / 100) / 10);

  let mode = $state<LegMode>(start.mode);
  let distanceKm = $state<string | number>(startKm);
  let durationMin = $state<string | number>(start.durationMin);
  let departAt = $state(start.departAt ?? '');
  let bookingRef = $state(start.bookingRef ?? '');
  let notes = $state(start.notes);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const transit = $derived(mode === 'bus' || mode === 'train');

  async function run(action: () => Promise<void>) {
    error = null;
    busy = true;
    try {
      await action();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const patch: LegPatch = {};
    if (isNew) {
      // Nouveau trajet : tout est saisi, la durée est obligatoire.
      const min = Number(durationMin);
      if (!Number.isInteger(min) || min < 1) {
        error = 'La durée doit être d’au moins une minute.';
        return;
      }
      patch.mode = mode;
      patch.durationMin = min;
      if (String(distanceKm).trim() !== '' && Number(distanceKm) >= 0) {
        patch.distanceM = Math.round(Number(distanceKm) * 1000);
      }
      await run(() => onSave(patch));
      return;
    }
    if (mode !== start.mode) patch.mode = mode;
    // Les champs numériques renvoient un nombre, ou '' quand ils sont vides.
    if (String(distanceKm) !== startKm) {
      const km = Number(distanceKm);
      if (String(distanceKm).trim() === '' || !Number.isFinite(km) || km < 0) {
        error = 'La distance doit être un nombre de kilomètres.';
        return;
      }
      patch.distanceM = Math.round(km * 1000);
    }
    if (Number(durationMin) !== start.durationMin) {
      const min = Number(durationMin);
      if (!Number.isInteger(min) || min < 1) {
        error = 'La durée doit être d’au moins une minute.';
        return;
      }
      patch.durationMin = min;
    }
    const nextDepart = departAt.trim() === '' ? null : departAt;
    if (nextDepart !== start.departAt) patch.departAt = nextDepart;
    const nextBooking = bookingRef.trim() === '' ? null : bookingRef.trim();
    if (nextBooking !== start.bookingRef) patch.bookingRef = nextBooking;
    if (notes !== start.notes) patch.notes = notes;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    await run(() => onSave(patch));
  }
</script>

<Modal title={isNew ? 'Nouveau trajet' : 'Modifier le trajet'} {onClose}>
  <form id="leg-form" class="form" onsubmit={submit} novalidate>
    {#if message}
      <p class="notice" role="status">{message}</p>
    {/if}
    {#if !isNew}
      <p class="origin">
        Valeurs actuelles : <b>{legSourceLabel(start)}</b>
        {#if start.summary}· {start.summary}{/if}
      </p>
    {/if}
    <label class="field">
      Mode
      <select bind:value={mode}>
        {#each LEG_MODES as m (m)}
          <option value={m}>{LEG_MODE_INFO[m].label}</option>
        {/each}
      </select>
    </label>
    <div class="row">
      <label class="field">
        Distance (km)
        <input type="number" min="0" step="0.1" bind:value={distanceKm} />
      </label>
      <label class="field">
        Durée (min)
        <input type="number" min="1" step="1" bind:value={durationMin} />
      </label>
    </div>
    <p class="hint">
      Une durée saisie est gardée. Une distance saisie seule donne une durée à la vitesse moyenne du
      mode.
    </p>
    <div class="row">
      <label class="field">
        Départ à
        <input type="time" bind:value={departAt} />
      </label>
      <label class="field">
        N° de réservation
        <input type="text" maxlength="200" bind:value={bookingRef} />
      </label>
    </div>
    {#if transit}
      <p class="hint">
        Sans heure de départ, l’itinéraire est cherché pour 09:00 (ou la fin de l’étape précédente
        si son heure est fixe).
      </p>
    {/if}
    <label class="field">
      Notes
      <textarea rows="2" maxlength="5000" bind:value={notes}></textarea>
    </label>
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
  </form>

  {#snippet actions()}
    {#if !isNew}
      <button type="button" class="btn btn-ghost danger" onclick={onDelete}>Supprimer</button>
    {/if}
    <span class="spacer"></span>
    {#if !isNew}
      <button type="button" class="btn btn-soft" disabled={busy} onclick={() => run(onRecompute)}
        >Recalculer</button
      >
    {/if}
    <button type="submit" form="leg-form" class="btn btn-primary" disabled={busy}
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

  .notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 13px;
    font-weight: 600;
  }

  .origin,
  .hint {
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
