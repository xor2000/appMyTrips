<script lang="ts">
  import Modal from './Modal.svelte';

  interface Props {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
    onCancel: () => void;
  }

  let { title, message, confirmLabel, onConfirm, onCancel }: Props = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  async function confirm() {
    busy = true;
    error = null;
    try {
      await onConfirm();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal {title} role="alertdialog" onClose={onCancel}>
  <p class="message">{message}</p>
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onCancel}>Annuler</button>
    <button type="button" class="btn btn-danger" disabled={busy} onclick={confirm}>
      {confirmLabel}
    </button>
  {/snippet}
</Modal>

<style>
  .message {
    margin: 0;
  }
</style>
