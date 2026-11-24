<script module lang="ts">
  import type Pencil from 'lucide-svelte/icons/pencil';

  /** Composant d'icône Lucide (même type pour toutes les icônes). */
  type Icon = typeof Pencil;

  /** Élément d'un sous-menu (« J2 », avec sa date en indice). */
  export interface MenuSubItem {
    label: string;
    hint: string | null;
    run: () => void;
  }

  /** Entrée du menu : action, lien (nouvel onglet) ou sous-menu. Chacune a son icône. */
  export type MenuEntry =
    | { kind: 'action'; label: string; icon: Icon; run: () => void; danger?: boolean }
    | { kind: 'link'; label: string; icon: Icon; href: string }
    | { kind: 'submenu'; label: string; icon: Icon; items: MenuSubItem[] };
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';

  interface Props {
    /** Position du pointeur (coordonnées de la fenêtre, `clientX` / `clientY`). */
    x: number;
    y: number;
    /** Nom accessible du menu (nom du lieu). */
    label: string;
    entries: MenuEntry[];
    onClose: () => void;
  }

  let { x, y, label, entries, onClose }: Props = $props();

  /** Élément qui avait le focus à l'ouverture : il le retrouve à la fermeture au clavier. */
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  /**
   * Taille d'affichage (`zoom` CSS de `<html>`, menu du profil) : le pointeur est en pixels de
   * l'écran, la position du menu en pixels CSS de la page zoomée.
   */
  const zoom =
    Number(document.documentElement.style.getPropertyValue('--zoom')) > 0
      ? Number(document.documentElement.style.getPropertyValue('--zoom'))
      : 1;

  const MARGIN = 8;
  let root: HTMLDivElement | undefined = $state();
  // Position initiale au pointeur, bornée à la fenêtre une fois la taille du menu connue.
  // svelte-ignore state_referenced_locally
  let left = $state(x / zoom);
  // svelte-ignore state_referenced_locally
  let top = $state(y / zoom);
  /** Sous-menu ouvert (index de son entrée) et s'il s'ouvre à gauche, faute de place à droite. */
  let openSub = $state<number | null>(null);
  let flip = $state(false);

  onMount(() => {
    if (root) {
      const width = window.innerWidth / zoom;
      const height = window.innerHeight / zoom;
      left = Math.max(MARGIN, Math.min(left, width - root.offsetWidth - MARGIN));
      top = Math.max(MARGIN, Math.min(top, height - root.offsetHeight - MARGIN));
    }
    itemsOf(root)[0]?.focus();
  });

  /** Éléments d'un menu (pas ceux de son sous-menu). */
  function itemsOf(menu: Element | null | undefined): HTMLElement[] {
    if (!menu) return [];
    return [
      ...menu.querySelectorAll<HTMLElement>(
        ':scope > [role="menuitem"], :scope > [role="none"] > [role="menuitem"]',
      ),
    ];
  }

  function close(refocus = false) {
    onClose();
    if (refocus) opener?.focus();
  }

  function run(action: () => void) {
    close();
    action();
  }

  async function showSub(index: number, focus: boolean) {
    const parent = itemsOf(root)[index];
    const width = window.innerWidth / zoom;
    flip = parent !== undefined && left + (root?.offsetWidth ?? 0) + 220 > width;
    openSub = index;
    if (!focus) return;
    await tick();
    itemsOf(root?.querySelector('[data-submenu]'))[0]?.focus();
  }

  function hideSub(refocus: boolean) {
    const index = openSub;
    openSub = null;
    if (refocus && index !== null) itemsOf(root)[index]?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null;
    const menu = active?.closest('[role="menu"]');
    const inSub = menu?.hasAttribute('data-submenu') ?? false;
    const list = itemsOf(menu);
    const index = active ? list.indexOf(active) : -1;
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
      case 'ArrowRight':
        if (!inSub && active?.getAttribute('aria-haspopup') === 'menu') void showSub(index, true);
        break;
      case 'ArrowLeft':
        if (inSub) hideSub(true);
        break;
      case 'Escape':
        if (inSub) hideSub(true);
        else close(true);
        break;
      case 'Tab':
        close();
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /** Un clic ou un toucher hors du menu le ferme (y compris le clic droit sur un autre lieu). */
  function onWindowPointerdown(event: PointerEvent) {
    if (root && !root.contains(event.target as Node)) close();
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} onresize={() => close()} />

<!-- Menu contextuel d'un lieu, au style du menu des fonds de la maquette de référence. -->
<div
  class="ctx"
  role="menu"
  aria-label={label}
  tabindex="-1"
  style:left={`${left}px`}
  style:top={`${top}px`}
  bind:this={root}
  onkeydown={onKeydown}
  oncontextmenu={(e) => e.preventDefault()}
>
  {#each entries as entry, i (entry.label)}
    {@const Icon = entry.icon}
    {#if entry.kind === 'link'}
      <!-- Lien externe (Google Maps) : resolve() ne s'applique qu'aux routes de l'appli. -->
      <!-- eslint-disable svelte/no-navigation-without-resolve -->
      <a
        role="menuitem"
        tabindex="-1"
        href={entry.href}
        target="_blank"
        rel="noopener noreferrer"
        onclick={() => close()}
      >
        <Icon size={15} aria-hidden="true" /><span>{entry.label}</span>
      </a>
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    {:else if entry.kind === 'submenu'}
      <div
        class="sub-wrap"
        role="none"
        onmouseenter={() => void showSub(i, false)}
        onmouseleave={() => hideSub(false)}
      >
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          aria-haspopup="menu"
          aria-expanded={openSub === i}
          onclick={() => void showSub(i, true)}
        >
          <Icon size={15} aria-hidden="true" /><span>{entry.label}</span>
          <ChevronRight class="chevron" size={14} aria-hidden="true" />
        </button>
        {#if openSub === i}
          <div class="ctx sub" class:flip role="menu" aria-label={entry.label} data-submenu>
            {#each entry.items as item, j (j)}
              <button type="button" role="menuitem" tabindex="-1" onclick={() => run(item.run)}>
                <span>{item.label}</span>
                {#if item.hint}<small>{item.hint}</small>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        class:danger={entry.danger}
        onclick={() => run(entry.run)}
      >
        <Icon size={15} aria-hidden="true" /><span>{entry.label}</span>
      </button>
    {/if}
  {/each}
</div>

<style>
  .ctx {
    position: fixed;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 190px;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-window);
  }

  .ctx:focus {
    outline: none;
  }

  /* Sous-menu à droite de son entrée (à gauche faute de place), défilant pour un long voyage. */
  .sub {
    position: absolute;
    top: -6px;
    left: calc(100% + 4px);
    min-width: 170px;
    max-height: 320px;
    overflow-y: auto;
  }

  .sub.flip {
    right: calc(100% + 4px);
    left: auto;
  }

  .sub-wrap {
    position: relative;
  }

  [role='menuitem'] {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--fg);
    font: 700 12.5px var(--font-display);
    text-align: left;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
  }

  [role='menuitem'] > :global(svg) {
    flex: none;
    color: var(--muted);
  }

  [role='menuitem']:hover,
  [role='menuitem']:focus-visible,
  [role='menuitem'][aria-expanded='true'] {
    background: var(--surface-2);
    outline: none;
  }

  [role='menuitem'] > :global(.chevron) {
    margin-left: auto;
  }

  .danger,
  .danger > :global(svg) {
    color: var(--bad);
  }

  .sub [role='menuitem'] {
    justify-content: space-between;
  }

  small {
    color: var(--muted);
    font: 600 11px var(--font-display);
  }
</style>
