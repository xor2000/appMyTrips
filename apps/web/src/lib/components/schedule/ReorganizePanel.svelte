<script lang="ts">
  import type { Fix } from '@mytrips/core';
  import Modal from '../Modal.svelte';

  interface Props {
    fixes: Fix[];
    onApply: (fix: Fix) => Promise<void>;
    onClose: () => void;
  }

  let { fixes, onApply, onClose }: Props = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  async function apply(fix: Fix) {
    busy = true;
    error = null;
    try {
      await onApply(fix);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Réorganiser la journée" {onClose}>
  {#if fixes.length === 0}
    <p class="empty">
      Aucune proposition n’améliore cette journée. Modifie les durées ou les heures fixes à la main.
    </p>
  {:else}
    <p class="intro">Chaque proposition a été simulée ; elle s’annule avec Ctrl+Z.</p>
    <ol class="fixes">
      {#each fixes as fix (fix.id)}
        <li>
          <div class="text">
            <span class="label">{fix.label}</span>
            <span class="effect">{fix.effect}</span>
          </div>
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy}
            aria-label={`Appliquer : ${fix.label}`}
            onclick={() => apply(fix)}>Appliquer</button
          >
        </li>
      {/each}
    </ol>
  {/if}
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <span class="spacer"></span>
    <button type="button" class="btn btn-ghost" onclick={onClose}>Fermer</button>
  {/snippet}
</Modal>

<style>
  .intro,
  .empty {
    margin: 0 0 var(--space-3);
    color: var(--muted);
    font-size: 13px;
  }

  .fixes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .fixes li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .label {
    font-weight: 600;
  }

  .effect {
    color: var(--ok);
    font-size: 13px;
  }

  .spacer {
    flex: 1;
  }
</style>
