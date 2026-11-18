<script lang="ts">
  import PasswordForm from '#lib/components/auth/PasswordForm.svelte';
  import LayoutPicker from '#lib/components/LayoutPicker.svelte';
  import ThemePicker from '#lib/components/ThemePicker.svelte';
  import { readLayout, saveLayout, type LayoutId } from '#lib/layout.ts';
  import { changePassword } from '#lib/api.ts';
  import { session } from '#lib/auth/session.svelte.ts';
  import { signOut } from '#lib/auth/signout.ts';

  let error = $state<string | null>(null);
  let layout = $state<LayoutId>(readLayout());

  function changeLayout(id: LayoutId) {
    layout = id;
    saveLayout(id);
  }

  async function leave() {
    error = null;
    try {
      await signOut();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<svelte:head>
  <title>Mon compte · MyTrips</title>
</svelte:head>

<div class="page">
  <h1>Mon compte</h1>
  {#if session.me}
    <p class="email">Connecté avec <strong>{session.me.email}</strong></p>
  {/if}

  <section class="panel">
    <h2>Apparence</h2>
    <p class="muted">Le thème et l’affichage sont mémorisés sur cet appareil.</p>
    <ThemePicker />
    <h3>Affichage de la journée</h3>
    <p class="muted">Changeable aussi depuis la page d’un voyage.</p>
    <LayoutPicker value={layout} onChange={changeLayout} />
  </section>

  <section class="panel">
    <h2>Changer de mot de passe</h2>
    <p class="muted">Les sessions ouvertes sur tes autres appareils seront fermées.</p>
    <PasswordForm
      askCurrent
      submitLabel="Changer le mot de passe"
      onSubmit={(next, current) => changePassword(current, next)}
    />
  </section>

  <section class="panel">
    <h2>Déconnexion</h2>
    <p class="muted">Les copies hors ligne de tes voyages sont effacées de cet appareil.</p>
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
    <div>
      <button type="button" class="btn btn-soft" onclick={leave}>Se déconnecter</button>
    </div>
  </section>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 560px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
  }

  .email {
    margin: 0;
    color: var(--muted);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 18px;
  }

  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
