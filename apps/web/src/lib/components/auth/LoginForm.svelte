<script lang="ts">
  import { Email, Password } from '@mytrips/core';

  interface Props {
    onLogin: (email: string, password: string) => Promise<void>;
    onSignup: (
      email: string,
      password: string,
      captcha: { token: string; answer: string },
    ) => Promise<void>;
    /** Nouvelle question de calcul (captcha, usage unique). */
    loadCaptcha: () => Promise<{ question: string; token: string }>;
  }

  let { onLogin, onSignup, loadCaptcha }: Props = $props();

  let mode = $state<'login' | 'signup'>('login');
  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let answer = $state('');
  let captcha = $state<{ question: string; token: string } | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function newCaptcha() {
    answer = '';
    try {
      captcha = await loadCaptcha();
    } catch (e) {
      captcha = null;
      error = message(e);
    }
  }

  function switchTo(next: 'login' | 'signup') {
    mode = next;
    error = null;
    if (next === 'signup' && !captcha) newCaptcha();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    const parsed = Email.safeParse(email);
    if (!parsed.success) {
      error = 'E-mail invalide.';
      return;
    }
    if (mode === 'login') {
      busy = true;
      try {
        await onLogin(parsed.data, password);
      } catch (e) {
        error = message(e);
      } finally {
        busy = false;
      }
      return;
    }
    const strong = Password.safeParse(password);
    if (!strong.success) {
      error = 'Le mot de passe doit faire au moins 10 caractères.';
      return;
    }
    if (password !== confirm) {
      error = 'Les mots de passe ne correspondent pas.';
      return;
    }
    if (!captcha) {
      await newCaptcha();
      return;
    }
    busy = true;
    try {
      await onSignup(parsed.data, password, { token: captcha.token, answer: answer.trim() });
    } catch (e) {
      error = message(e);
      // Le captcha a été consommé : nouvelle question.
      await newCaptcha();
    } finally {
      busy = false;
    }
  }
</script>

<div class="auth-card">
  <div class="tabs" role="tablist" aria-label="Connexion ou inscription">
    <button
      type="button"
      role="tab"
      aria-selected={mode === 'login'}
      class:active={mode === 'login'}
      onclick={() => switchTo('login')}>Se connecter</button
    >
    <button
      type="button"
      role="tab"
      aria-selected={mode === 'signup'}
      class:active={mode === 'signup'}
      onclick={() => switchTo('signup')}>Créer un compte</button
    >
  </div>

  <form onsubmit={submit} novalidate>
    <label class="field">
      E-mail
      <input type="email" bind:value={email} autocomplete="username" required />
    </label>
    <label class="field">
      Mot de passe
      <input
        type="password"
        bind:value={password}
        autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
      />
    </label>

    {#if mode === 'signup'}
      <label class="field">
        Confirmer le mot de passe
        <input type="password" bind:value={confirm} autocomplete="new-password" required />
      </label>
      <p class="hint">Au moins 10 caractères.</p>
      <div class="captcha">
        <p class="question">{captcha?.question ?? 'Chargement de la question…'}</p>
        <label class="field">
          Réponse
          <input type="text" inputmode="numeric" bind:value={answer} autocomplete="off" />
        </label>
      </div>
    {/if}

    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={busy}>
      {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
    </button>
  </form>
</div>

<style>
  .auth-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    width: min(420px, 100%);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
  }

  .tabs button {
    flex: 1;
    min-height: 34px;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--muted);
    font: 600 14px var(--font-display);
    cursor: pointer;
  }

  .tabs button.active {
    background: var(--surface);
    color: var(--fg);
    box-shadow: var(--shadow-card);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .captcha {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--accent-soft);
  }

  .question {
    margin: 0;
    color: var(--accent-strong);
    font-weight: 600;
  }
</style>
