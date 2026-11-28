<script lang="ts">
  import Columns3 from 'lucide-svelte/icons/columns-3';
  import PanelLeft from 'lucide-svelte/icons/panel-left';
  import { LAYOUTS, type LayoutId } from '#lib/layout.ts';

  interface Props {
    value: LayoutId;
    onChange: (id: LayoutId) => void;
  }

  let { value, onChange }: Props = $props();

  const icons = { list: PanelLeft, board: Columns3 };
</script>

<!-- Sélecteur rapide de l'affichage, sur la page d'un voyage (le réglage vit aussi sur « Mon compte »). -->
<div class="switch" role="group" aria-label="Affichage">
  {#each LAYOUTS as layout (layout.id)}
    {@const Icon = icons[layout.id]}
    <button
      type="button"
      aria-label={layout.label}
      title={layout.label}
      aria-pressed={value === layout.id}
      onclick={() => onChange(layout.id)}><Icon size={16} /></button
    >
  {/each}
</div>

<style>
  .switch {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }

  button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 28px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  button:hover {
    color: var(--fg);
  }

  button[aria-pressed='true'] {
    background: var(--surface);
    color: var(--accent-strong);
    box-shadow: var(--shadow-card);
  }
</style>
