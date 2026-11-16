<script lang="ts">
  import type { Me } from '@mytrips/core';
  import { resolve } from '$app/paths';

  interface Props {
    /** Utilisateur connecté, s'il est connu. */
    me?: Me | null;
  }

  let { me = null }: Props = $props();
</script>

<header class="app-header">
  <a class="brand" href={resolve('/')}>
    <img src="/favicon.svg" alt="" width="36" height="36" />
    <span>MyTrips</span>
  </a>
  {#if me}
    <nav class="account" aria-label="Compte">
      {#if me.isAdmin}
        <a class="link" href={resolve('/admin')}>Administration</a>
      {/if}
      <a class="user" href={resolve('/compte')} data-testid="user-email" title="Mon compte"
        >{me.email}</a
      >
    </nav>
  {/if}
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-6);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--fg);
    text-decoration: none;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
  }

  .brand img {
    border-radius: 11px;
  }

  .account {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .link {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .link:hover {
    color: var(--fg);
  }

  .user {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 13px;
    text-decoration: none;
  }

  .user:hover {
    background: var(--line);
    color: var(--fg);
  }
</style>
