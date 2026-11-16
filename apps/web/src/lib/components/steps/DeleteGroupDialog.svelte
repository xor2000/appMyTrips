<script lang="ts">
  import { plural } from '#lib/format.ts';
  import Modal from '../Modal.svelte';

  interface Props {
    name: string;
    childCount: number;
    onConfirm: (children: 'keep' | 'delete') => Promise<void>;
    onCancel: () => void;
  }

  let { name, childCount, onConfirm, onCancel }: Props = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  async function confirm(children: 'keep' | 'delete') {
    busy = true;
    error = null;
    try {
      await onConfirm(children);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Supprimer le dossier ?" role="alertdialog" onClose={onCancel}>
  <p class="message">
    « {name} » contient {plural(childCount, 'étape')}. Gardez-les à la place du dossier, ou
    supprimez-les avec lui.
  </p>
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onCancel}>Annuler</button>
    <button type="button" class="btn btn-soft" disabled={busy} onclick={() => confirm('keep')}>
      Garder les étapes
    </button>
    <button type="button" class="btn btn-danger" disabled={busy} onclick={() => confirm('delete')}>
      Tout supprimer
    </button>
  {/snippet}
</Modal>

<style>
  .message {
    margin: 0;
  }
</style>
