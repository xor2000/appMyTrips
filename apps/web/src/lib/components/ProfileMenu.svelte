<script lang="ts">
  import type { Me } from '@mytrips/core';
  import { tick } from 'svelte';
  import { resolve } from '$app/paths';
  import ALargeSmall from 'lucide-svelte/icons/a-large-small';
  import Check from 'lucide-svelte/icons/check';
  import CircleUserRound from 'lucide-svelte/icons/circle-user-round';
  import LogOut from 'lucide-svelte/icons/log-out';
  import Monitor from 'lucide-svelte/icons/monitor';
  import Moon from 'lucide-svelte/icons/moon';
  import NotebookPen from 'lucide-svelte/icons/notebook-pen';
  import Palette from 'lucide-svelte/icons/palette';
  import Settings from 'lucide-svelte/icons/settings';
  import ShieldCheck from 'lucide-svelte/icons/shield-check';
  import Sun from 'lucide-svelte/icons/sun';
  import { signOut } from '#lib/auth/signout.ts';
  import { scale, SCALES, setScale } from '#lib/scale.svelte.ts';
  import { readTheme, saveTheme, THEMES, type ThemeId } from '#lib/theme.ts';

  interface Props {
    /** Utilisateur connecté. */
    me: Me;
  }

  let { me }: Props = $props();

  const themeIcons: Record<ThemeId, typeof Monitor> = {
    auto: Monitor,
    'pastel-light': Sun,
    'pastel-dark': Moon,
    carnet: NotebookPen,
  };

  let open = $state(false);
  let theme = $state<ThemeId>('auto');
  let error = $state<string | null>(null);
  let busy = $state(false);
  let root: HTMLElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let menu: HTMLElement | undefined = $state();

  function items(): HTMLElement[] {
    return menu ? [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')] : [];
  }

  async function show() {
    // Relu à chaque ouverture : le thème a pu changer sur « Mon compte ».
    theme = readTheme();
    error = null;
    open = true;
    await tick();
    items()[0]?.focus();
  }

  function close(refocus = false) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function chooseTheme(id: ThemeId) {
    theme = id;
    saveTheme(id);
    close(true);
  }

  async function leave() {
    error = null;
    busy = true;
    try {
      await signOut();
      open = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
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

<div class="profile" bind:this={root}>
  <button
    type="button"
    class="avatar"
    bind:this={trigger}
    aria-label={`Menu du compte (${me.email})`}
    title={me.email}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="profile-menu"
    onclick={() => (open ? close() : show())}
  >
    <CircleUserRound size={22} aria-hidden="true" />
  </button>

  {#if open}
    <div
      id="profile-menu"
      class="menu"
      role="menu"
      aria-label="Compte"
      tabindex="-1"
      bind:this={menu}
      onkeydown={onMenuKeydown}
    >
      <p class="who">
        <span>Connecté</span>
        <strong>{me.email}</strong>
      </p>

      <div role="group" aria-labelledby="profile-menu-theme">
        <p class="group-label" id="profile-menu-theme">
          <Palette size={14} aria-hidden="true" /> Thème
        </p>
        {#each THEMES as t (t.id)}
          {@const Icon = themeIcons[t.id]}
          <button
            type="button"
            class="item sub"
            role="menuitemradio"
            aria-checked={theme === t.id}
            tabindex="-1"
            onclick={() => chooseTheme(t.id)}
          >
            <Icon size={16} aria-hidden="true" />
            <span class="label">{t.label}</span>
            {#if theme === t.id}<Check size={16} aria-hidden="true" />{/if}
          </button>
        {/each}
      </div>

      <!-- Taille d'affichage, comme appMyBank : segments ; le menu reste ouvert pour comparer. -->
      <div class="scale" role="group" aria-labelledby="profile-menu-scale">
        <p class="group-label" id="profile-menu-scale">
          <ALargeSmall size={14} aria-hidden="true" /> Taille d’affichage
        </p>
        <div class="segments">
          {#each SCALES as value (value)}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={scale.value === value}
              tabindex="-1"
              onclick={() => setScale(value)}>{value} %</button
            >
          {/each}
        </div>
      </div>

      <hr />

      <a
        class="item"
        role="menuitem"
        tabindex="-1"
        href={resolve('/compte')}
        onclick={() => close()}
      >
        <Settings size={16} aria-hidden="true" />
        <span class="label">Paramètres</span>
      </a>
      {#if me.isAdmin}
        <a
          class="item"
          role="menuitem"
          tabindex="-1"
          href={resolve('/admin')}
          onclick={() => close()}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          <span class="label">Administration</span>
        </a>
      {/if}

      <hr />

      <button
        type="button"
        class="item"
        role="menuitem"
        tabindex="-1"
        disabled={busy}
        onclick={leave}
      >
        <LogOut size={16} aria-hidden="true" />
        <span class="label">Se déconnecter</span>
      </button>
      {#if error}
        <p class="form-error" role="alert">{error}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .profile {
    position: relative;
    flex: none;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--muted);
    cursor: pointer;
  }

  .avatar:hover,
  .avatar[aria-expanded='true'] {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .menu {
    position: absolute;
    top: calc(100% + var(--space-2));
    right: 0;
    width: min(270px, calc(100vw - 2 * var(--space-4)));
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-window);
  }

  .menu:focus {
    outline: none;
  }

  .who {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: var(--space-2) var(--space-3) var(--space-3);
    font-size: 12px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  .who strong {
    color: var(--fg);
    font-size: 14px;
    font-weight: 600;
  }

  .group-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-2) var(--space-3) var(--space-1);
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }

  .segments {
    display: flex;
    margin: 0 var(--space-3) var(--space-1);
    padding: 2px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }

  .segments button {
    flex: 1;
    min-height: 28px;
    border: 0;
    border-radius: calc(var(--radius-sm) - 2px);
    background: transparent;
    color: var(--muted);
    font: 600 13px var(--font-body);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .segments button:hover,
  .segments button:focus-visible {
    color: var(--fg);
    outline: none;
  }

  .segments button[aria-checked='true'] {
    background: var(--accent);
    color: var(--on-accent);
  }

  hr {
    margin: var(--space-2) 0;
    border: 0;
    border-top: 1px solid var(--line);
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--fg);
    font-size: 14px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .item.sub {
    padding-left: var(--space-6);
  }

  .item :global(svg) {
    flex: none;
    color: var(--muted);
  }

  .item:hover,
  .item:focus-visible {
    background: var(--surface-2);
    outline: none;
  }

  .item[aria-checked='true'] {
    color: var(--accent);
    font-weight: 600;
  }

  .item[aria-checked='true'] :global(svg) {
    color: var(--accent);
  }

  .item:disabled {
    cursor: progress;
    opacity: 0.6;
  }

  .label {
    flex: 1;
  }

  .form-error {
    margin: var(--space-2) var(--space-3) 0;
  }
</style>
