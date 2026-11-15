<script lang="ts">
  interface Props {
    /** Une nouvelle version du service worker est prête. */
    needRefresh: boolean;
    onReload: () => void;
    onDismiss: () => void;
  }

  let { needRefresh, onReload, onDismiss }: Props = $props();
</script>

{#if needRefresh}
  <div class="update" role="status">
    <span>Nouvelle version disponible</span>
    <button type="button" class="primary" onclick={onReload}>Recharger</button>
    <button type="button" class="ghost" onclick={onDismiss}>Plus tard</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    right: var(--space-6);
    bottom: var(--space-6);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--surface);
    box-shadow: var(--shadow-float);
    font-weight: 500;
  }

  button {
    border: 0;
    border-radius: var(--radius-pill);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    font-weight: 600;
  }

  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }

  .ghost {
    background: transparent;
    color: var(--muted);
  }
</style>
