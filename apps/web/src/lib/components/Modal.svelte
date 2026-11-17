<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    title: string;
    /** `alertdialog` pour une confirmation. */
    role?: 'dialog' | 'alertdialog';
    onClose: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  let { title, role = 'dialog', onClose, children, actions }: Props = $props();

  const titleId = `modal-${Math.random().toString(36).slice(2)}`;
  let panel: HTMLDivElement;

  onMount(() => {
    // Focus sur le premier champ (ou bouton) de la fenêtre.
    panel.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="backdrop">
  <div class="panel" {role} aria-modal="true" aria-labelledby={titleId} bind:this={panel}>
    <h2 id={titleId}>{title}</h2>
    <div class="content">{@render children()}</div>
    {#if actions}
      <div class="actions">{@render actions()}</div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: var(--space-6);
    background: var(--scrim);
    animation: fade 0.15s ease-out;
  }

  .panel {
    width: min(480px, 100%);
    max-height: calc(100vh - 2 * var(--space-6));
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-float);
    animation: rise 0.18s ease-out;
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }
</style>
