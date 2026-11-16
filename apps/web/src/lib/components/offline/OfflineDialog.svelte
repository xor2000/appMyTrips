<script lang="ts">
  import { estimateTileBytes } from '@mytrips/core';
  import type { PreparedTrip } from '#lib/offline/store.ts';
  import Modal from '../Modal.svelte';

  interface Props {
    /** Tuiles à précharger pour le voyage. */
    tileCount: number;
    /** Zoom maximal abaissé pour rester sous le plafond. */
    reduced: boolean;
    prepared: PreparedTrip | null;
    /** Espace utilisé par l'application (navigator.storage), ou null s'il est inconnu. */
    usedBytes: number | null;
    progress: { done: number; total: number } | null;
    error: string | null;
    onPrepare: () => void;
    onRelease: () => void;
    onClose: () => void;
  }

  let {
    tileCount,
    reduced,
    prepared,
    usedBytes,
    progress,
    error,
    onPrepare,
    onRelease,
    onClose,
  }: Props = $props();

  const mo = (bytes: number) => `${Math.max(1, Math.round(bytes / 1_000_000))} Mo`;
  const preparedOn = $derived(
    prepared
      ? new Date(prepared.at).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
  );
</script>

<Modal title="Préparer hors ligne" {onClose}>
  <div class="body">
    <p>
      Garde sur cet appareil le voyage et la carte de sa zone (zooms 6 à 14), pour le consulter sans
      réseau. La modification reste réservée au mode en ligne.
    </p>
    <p class="estimate">
      {tileCount.toLocaleString('fr-FR')} tuiles · environ {mo(estimateTileBytes(tileCount))}
    </p>
    {#if reduced}
      <p class="hint">La zone est vaste : la carte hors ligne s’arrête à un zoom moins détaillé.</p>
    {/if}
    {#if prepared}
      <p class="ready">✓ Disponible hors ligne (préparé le {preparedOn})</p>
    {/if}
    {#if usedBytes !== null}
      <p class="hint">{mo(usedBytes)} utilisés par MyTrips sur cet appareil.</p>
    {/if}
    {#if progress}
      <progress
        max={progress.total}
        value={progress.done}
        aria-label="Préchargement de la carte"
        aria-valuemin="0"
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      ></progress>
      <p class="hint">{progress.done} / {progress.total}</p>
    {/if}
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
  </div>

  {#snippet actions()}
    {#if prepared}
      <button type="button" class="btn btn-ghost" disabled={progress !== null} onclick={onRelease}
        >Libérer</button
      >
    {/if}
    <span class="spacer"></span>
    <button type="button" class="btn btn-ghost" onclick={onClose}>Fermer</button>
    <button
      type="button"
      class="btn btn-primary"
      disabled={progress !== null || tileCount === 0}
      onclick={onPrepare}>{prepared ? 'Mettre à jour' : 'Préparer'}</button
    >
  {/snippet}
</Modal>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .body p {
    margin: 0;
  }

  .estimate {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  .hint {
    color: var(--muted);
    font-size: 13px;
  }

  .ready {
    color: var(--ok);
    font-weight: 600;
  }

  progress {
    width: 100%;
    accent-color: var(--accent);
  }

  .spacer {
    flex: 1;
  }
</style>
