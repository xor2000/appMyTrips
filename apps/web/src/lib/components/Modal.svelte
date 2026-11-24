<script lang="ts">
  import X from 'lucide-svelte/icons/x';
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    title: string;
    /** Phrase sous le titre (comme la maquette), qui décrit la fenêtre. */
    subtitle?: string | null;
    /** Masquée sans être fermée (ex. le temps de choisir une position sur la carte). */
    hidden?: boolean;
    /** `alertdialog` pour une confirmation. */
    role?: 'dialog' | 'alertdialog';
    onClose: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  let {
    title,
    subtitle = null,
    hidden = false,
    role = 'dialog',
    onClose,
    children,
    actions,
  }: Props = $props();

  const titleId = `modal-${Math.random().toString(36).slice(2)}`;
  const subtitleId = `${titleId}-sub`;
  let panel: HTMLDivElement;

  onMount(() => {
    // Focus sur le champ désigné (`data-autofocus`), sinon sur le premier champ (ou bouton) du
    // contenu, sinon des actions : pas sur la croix.
    (
      panel.querySelector<HTMLElement>('.content [data-autofocus]') ??
      panel.querySelector<HTMLElement>(
        '.content :is(input, select, textarea, button), .actions :is(input, select, textarea, button)',
      )
    )?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    // Échap déjà traité ailleurs (ex. abandon du choix sur la carte, qui réaffiche la fenêtre).
    if (event.key === 'Escape' && !hidden && !event.defaultPrevented) onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Fenêtre façon maquette de référence : fond assombri et flouté, en-tête avec croix. -->
<div class="backdrop" {hidden}>
  <div
    class="panel"
    {role}
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={subtitle ? subtitleId : undefined}
    bind:this={panel}
  >
    <div class="head">
      <div class="titles">
        <h2 id={titleId}>{title}</h2>
        {#if subtitle}<p id={subtitleId} class="subtitle">{subtitle}</p>{/if}
      </div>
      <button type="button" class="icon-btn" aria-label="Fermer la fenêtre" onclick={onClose}>
        <X size={18} />
      </button>
    </div>
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
    padding: 18px;
    background: var(--scrim);
    backdrop-filter: blur(3px);
    animation: fade 0.15s ease;
  }

  .backdrop[hidden] {
    display: none;
  }

  .panel {
    width: min(480px, 100%);
    max-height: calc(100dvh - 36px);
    overflow: auto;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-modal);
    animation: rise 0.18s ease;
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 20px 20px 4px;
  }

  h2 {
    padding-top: 6px;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .subtitle {
    margin: 3px 0 0;
    font-size: 12.5px;
    color: var(--muted);
  }

  .head .icon-btn {
    margin: -2px -8px 0 0;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 20px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
    padding: 6px 20px 20px;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
  }
</style>
