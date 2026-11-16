<script lang="ts">
  import { drag } from '#lib/steps/dnd.svelte.ts';

  interface Props {
    /** Refuser les dossiers (zone à l'intérieur d'un dossier). */
    stepsOnly?: boolean;
    label: string;
    onDrop: (stepId: string) => void;
  }

  let { stepsOnly = false, label, onDrop }: Props = $props();

  let over = $state(false);
  const active = $derived(drag.stepId !== null && !(stepsOnly && drag.kind === 'group'));

  function onDragOver(event: DragEvent) {
    if (!active) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    over = true;
  }

  function handleDrop(event: DragEvent) {
    if (!active || !drag.stepId) return;
    event.preventDefault();
    over = false;
    onDrop(drag.stepId);
  }
</script>

<div
  class="zone"
  class:active
  class:over
  role="presentation"
  data-testid="drop-zone"
  aria-label={label}
  ondragover={onDragOver}
  ondragleave={() => (over = false)}
  ondrop={handleDrop}
></div>

<style>
  /*
   * Hauteur fixe : la zone ne doit jamais changer de taille pendant un glisser, sinon la liste se
   * décale sous le curseur et le dépôt tombe ailleurs. Seule la couleur signale la zone visée.
   */
  .zone {
    height: var(--space-3);
    margin: 0 var(--space-2);
    border-radius: var(--radius-pill);
    transition: background-color 0.12s;
  }

  .zone.active {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .zone.over {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 2px var(--accent);
  }
</style>
