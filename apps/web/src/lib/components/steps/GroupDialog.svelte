<script lang="ts">
  import Modal from '../Modal.svelte';

  interface Props {
    onCreate: (name: string) => Promise<void>;
    onClose: () => void;
  }

  let { onCreate, onClose }: Props = $props();

  let name = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = 'Donnez un nom au dossier.';
      return;
    }
    busy = true;
    error = null;
    try {
      await onCreate(name.trim());
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Nouveau dossier" {onClose}>
  <form id="group-form" onsubmit={submit} novalidate>
    <label class="field">
      Nom du dossier
      <input
        type="text"
        bind:value={name}
        maxlength="200"
        placeholder="Vieux-Port, centre historique…"
      />
    </label>
  </form>
  <p class="hint">Un dossier regroupe des étapes proches : glissez-les dedans ensuite.</p>
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
    <button type="submit" form="group-form" class="btn btn-primary" disabled={busy}
      >Créer le dossier</button
    >
  {/snippet}
</Modal>

<style>
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
