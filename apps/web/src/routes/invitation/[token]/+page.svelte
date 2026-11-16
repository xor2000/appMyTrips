<script lang="ts">
  import type { Role } from '@mytrips/core';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { acceptInvitation, getInvitation, type InvitationPreview } from '#lib/api.ts';

  const token = $derived(page.params.token ?? '');
  const roleLabels: Record<Role, string> = {
    viewer: 'en lecture seule',
    editor: 'avec le droit de le modifier',
  };

  let invitation = $state<InvitationPreview | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  onMount(async () => {
    // Sans session, l'API répond 401 et le layout renvoie vers la connexion (retour ici ensuite).
    try {
      invitation = await getInvitation(token);
    } catch (e) {
      error = message(e);
    }
  });

  async function accept() {
    busy = true;
    error = null;
    try {
      const { tripId } = await acceptInvitation(token);
      await goto(resolve('/trips/[id]', { id: tripId }), { replaceState: true });
    } catch (e) {
      error = message(e);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Invitation · MyTrips</title>
</svelte:head>

<div class="page">
  <section class="panel">
    <h1>Invitation à un voyage</h1>
    {#if invitation}
      <p>
        <strong>{invitation.ownerEmail}</strong> t’invite à rejoindre
        <strong>{invitation.tripName}</strong>
        {roleLabels[invitation.role]}.
      </p>
      <button type="button" class="btn btn-primary" disabled={busy} onclick={accept}
        >Rejoindre le voyage</button
      >
    {:else if !error}
      <p class="muted">Chargement…</p>
    {/if}
    {#if error}
      <p class="form-error" role="alert">{error}</p>
      <a class="btn btn-soft" href={resolve('/')}>Mes voyages</a>
    {/if}
  </section>
</div>

<style>
  .page {
    display: flex;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: min(480px, 100%);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 22px;
  }

  p {
    margin: 0;
  }

  .muted {
    color: var(--muted);
  }
</style>
