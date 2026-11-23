<script lang="ts">
  import Pencil from 'lucide-svelte/icons/pencil';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import type { StepPopupInfo } from '#lib/map/stepPopup.ts';

  interface Props {
    info: StepPopupInfo;
    /** Boutons « Modifier » et « Supprimer » seulement pour qui peut modifier le voyage. */
    canEdit: boolean;
    onEdit: (stepId: string) => void;
    onDelete: (stepId: string) => void;
  }

  let { info, canEdit, onEdit, onDelete }: Props = $props();
</script>

<!-- Popup d'un lieu, comme la maquette de référence : « type · jour », nom, notes, actions. -->
<div class="step-popup" data-testid="step-popup" style={`--pc: var(${info.color})`}>
  <div class="cat">{info.context ? `${info.category} · ${info.context}` : info.category}</div>
  <h4>{info.name}</h4>
  {#if info.notes}
    <p class="notes">{info.notes}</p>
  {/if}
  {#if canEdit}
    <div class="actions">
      <button type="button" class="btn btn-ghost" onclick={() => onEdit(info.stepId)}>
        <Pencil size={14} aria-hidden="true" />Modifier
      </button>
      <button type="button" class="btn btn-ghost" onclick={() => onDelete(info.stepId)}>
        <Trash2 size={14} aria-hidden="true" />Supprimer
      </button>
    </div>
  {/if}
</div>

<style>
  .step-popup {
    min-width: 200px;
    max-width: 260px;
    line-height: 1.35;
  }

  .cat {
    padding-right: 22px;
    color: var(--pc, var(--accent));
    font: 800 10.5px var(--font-display);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  h4 {
    margin: 1px 0 0;
    color: var(--fg);
    font: 800 15px var(--font-display);
    letter-spacing: -0.01em;
  }

  .notes {
    margin: 7px 0 0;
    color: var(--muted);
    font-size: 12.5px;
    white-space: pre-wrap;
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }

  .actions .btn {
    flex: 1;
    justify-content: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
  }
</style>
