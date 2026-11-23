<script lang="ts">
  import { tick } from 'svelte';
  import Check from 'lucide-svelte/icons/check';
  import Layers from 'lucide-svelte/icons/layers';
  import type { MapStyleId } from '#lib/map/styles.ts';

  interface Props {
    /** Fond affiché. */
    value: MapStyleId;
    /** Appelé quand l'utilisateur choisit un autre fond. */
    onSelect: (id: MapStyleId) => void;
  }

  let { value, onSelect }: Props = $props();

  const OPTIONS: { id: MapStyleId; label: string }[] = [
    { id: 'plan', label: 'Plan' },
    { id: 'topo', label: 'Topo' },
    { id: 'satellite', label: 'Satellite' },
  ];

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let menu: HTMLElement | undefined = $state();

  function items(): HTMLElement[] {
    return menu ? [...menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')] : [];
  }

  async function show() {
    open = true;
    await tick();
    const list = items();
    (list.find((i) => i.getAttribute('aria-checked') === 'true') ?? list[0])?.focus();
  }

  function close(refocus = false) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function choose(id: MapStyleId) {
    if (id !== value) onSelect(id);
    close(true);
  }

  function onMenuKeydown(event: KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(-1);
        break;
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close();
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  /** Un clic ou un toucher hors du menu le ferme. */
  function onWindowPointerdown(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) close();
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} />

<!-- Comme la maquette de référence : la liste s'ouvre au-dessus du bouton. -->
<div class="basemap" bind:this={root}>
  {#if open}
    <div
      id="basemap-menu"
      class="menu"
      role="menu"
      aria-label="Choix du fond de carte"
      tabindex="-1"
      bind:this={menu}
      onkeydown={onMenuKeydown}
    >
      {#each OPTIONS as option (option.id)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={value === option.id}
          tabindex="-1"
          onclick={() => choose(option.id)}
        >
          <span>{option.label}</span>
          {#if value === option.id}<Check size={15} aria-hidden="true" />{/if}
        </button>
      {/each}
    </div>
  {/if}
  <button
    type="button"
    class="trigger"
    bind:this={trigger}
    title="Changer le fond de carte"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="basemap-menu"
    onclick={() => (open ? close() : show())}
  >
    <Layers size={16} aria-hidden="true" />
    <span>Fond de carte</span>
  </button>
</div>

<style>
  .basemap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--btn-radius);
    background: var(--surface);
    box-shadow: var(--shadow-float);
    color: var(--fg);
    font: 700 12.5px var(--font-display);
    cursor: pointer;
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    border-color: var(--accent);
    color: var(--accent-strong);
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 178px;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-window);
  }

  .menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--fg);
    font: 700 12.5px var(--font-display);
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }

  .menu button:hover,
  .menu button:focus-visible {
    background: var(--surface-2);
    outline: none;
  }

  .menu button[aria-checked='true'] {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
</style>
