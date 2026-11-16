<script lang="ts">
  import AdminPanel from '#lib/components/auth/AdminPanel.svelte';
  import { adminCreateReset, adminListBans, adminUnban } from '#lib/api.ts';
  import { session } from '#lib/auth/session.svelte.ts';

  async function createReset(email: string) {
    const { token } = await adminCreateReset(email);
    return `${location.origin}/reinitialisation/${token}`;
  }
</script>

<svelte:head>
  <title>Administration · MyTrips</title>
</svelte:head>

<div class="page">
  <h1>Administration</h1>
  {#if session.me && !session.me.isAdmin}
    <p class="form-error" role="alert">Page réservée aux administrateurs.</p>
  {:else if session.me}
    <AdminPanel
      loadBans={() => adminListBans()}
      onUnban={(ip) => adminUnban(ip)}
      onCreateReset={createReset}
    />
  {:else}
    <p class="muted">Chargement…</p>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 820px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
  }

  .muted {
    margin: 0;
    color: var(--muted);
  }
</style>
