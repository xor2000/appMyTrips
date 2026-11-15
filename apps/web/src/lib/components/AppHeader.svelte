<script lang="ts">
  import { resolve } from '$app/paths';

  interface Props {
    /** E-mail de l'utilisateur connecté, s'il est connu. */
    userEmail?: string | null;
  }

  let { userEmail = null }: Props = $props();
</script>

<header class="app-header">
  <a class="brand" href={resolve('/')}>
    <img src="/favicon.svg" alt="" width="36" height="36" />
    <span>MyTrips</span>
  </a>
  {#if userEmail}
    <span class="user" data-testid="user-email">{userEmail}</span>
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

  .user {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 13px;
  }
</style>
