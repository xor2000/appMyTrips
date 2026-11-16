<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import PasswordForm from '#lib/components/auth/PasswordForm.svelte';
  import { resetPassword } from '#lib/api.ts';

  const token = $derived(page.params.token ?? '');
  let done = $state(false);
</script>

<svelte:head>
  <title>Nouveau mot de passe · MyTrips</title>
</svelte:head>

<div class="page">
  <section class="panel">
    <h1>Nouveau mot de passe</h1>
    <p class="muted">Ce lien ne sert qu’une fois. Tes sessions ouvertes seront fermées.</p>
    <PasswordForm
      submitLabel="Enregistrer le mot de passe"
      doneMessage="Mot de passe enregistré : tu peux te connecter."
      onSubmit={async (next) => {
        await resetPassword(token, next);
        done = true;
      }}
    />
    {#if done}
      <a class="btn btn-primary" href={resolve('/connexion')}>Se connecter</a>
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
    width: min(420px, 100%);
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

  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
