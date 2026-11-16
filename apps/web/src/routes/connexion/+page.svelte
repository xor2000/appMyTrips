<script lang="ts">
  import type { Me } from '@mytrips/core';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import LoginForm from '#lib/components/auth/LoginForm.svelte';
  import { fetchSession, getCaptcha, login, signup } from '#lib/api.ts';
  import { safeNext } from '#lib/auth/next.ts';
  import { session } from '#lib/auth/session.svelte.ts';

  const next = $derived(safeNext(page.url.searchParams.get('suite')));

  async function done(me: Me) {
    session.me = me;
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- chemin interne vérifié par safeNext
    await goto(next, { replaceState: true });
  }

  onMount(async () => {
    // Déjà connecté : directement vers la page demandée.
    const s = await fetchSession();
    if (s.state === 'signed-in') await done(s.me);
  });
</script>

<svelte:head>
  <title>Connexion · MyTrips</title>
</svelte:head>

<div class="page">
  <section class="intro">
    <h1>Bienvenue</h1>
    <p>Connecte-toi pour retrouver tes voyages, ou crée ton compte.</p>
  </section>
  <LoginForm
    onLogin={async (email, password) => done(await login(email, password))}
    onSignup={async (email, password, captcha) => done(await signup(email, password, captcha))}
    loadCaptcha={() => getCaptcha()}
  />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-8) var(--space-4);
  }

  .intro {
    text-align: center;
  }

  h1 {
    margin: 0 0 var(--space-2);
    font-family: var(--font-display);
    font-size: 28px;
  }

  p {
    margin: 0;
    color: var(--muted);
  }
</style>
