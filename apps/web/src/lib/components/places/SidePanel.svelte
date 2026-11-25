<script lang="ts">
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import type { Snippet } from 'svelte';

  /**
   * Panneau gauche commun à « Explorer la zone » et « Rechercher » : il remplace la journée, avec
   * « Retour au jour » et un titre.
   */
  interface Props {
    /** Nom accessible de la région. */
    label: string;
    title: string;
    onBack: () => void;
    children: Snippet;
  }

  let { label, title, onBack, children }: Props = $props();
</script>

<section class="side-panel" aria-label={label}>
  <div class="head">
    <button type="button" class="btn btn-ghost back" onclick={onBack}>
      <ArrowLeft size={16} />Retour au jour
    </button>
    <h2>{title}</h2>
  </div>
  {@render children()}
</section>

<style>
  .side-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .head h2 {
    font-size: 20px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
</style>
