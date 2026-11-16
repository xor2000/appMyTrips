<script lang="ts">
  import { Password } from '@mytrips/core';

  interface Props {
    /** Demander le mot de passe actuel (changement depuis la page du compte). */
    askCurrent?: boolean;
    submitLabel: string;
    /** Message affiché après réussite. */
    doneMessage?: string;
    onSubmit: (next: string, current: string) => Promise<void>;
  }

  let {
    askCurrent = false,
    submitLabel,
    doneMessage = 'Mot de passe enregistré.',
    onSubmit,
  }: Props = $props();

  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let error = $state<string | null>(null);
  let done = $state(false);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    done = false;
    if (!Password.safeParse(next).success) {
      error = 'Le nouveau mot de passe doit faire au moins 10 caractères.';
      return;
    }
    if (next !== confirm) {
      error = 'Les mots de passe ne correspondent pas.';
      return;
    }
    busy = true;
    try {
      await onSubmit(next, current);
      done = true;
      current = next = confirm = '';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={submit} novalidate>
  {#if askCurrent}
    <label class="field">
      Mot de passe actuel
      <input type="password" bind:value={current} autocomplete="current-password" />
    </label>
  {/if}
  <label class="field">
    Nouveau mot de passe
    <input type="password" bind:value={next} autocomplete="new-password" />
  </label>
  <label class="field">
    Confirmer le nouveau mot de passe
    <input type="password" bind:value={confirm} autocomplete="new-password" />
  </label>
  <p class="hint">Au moins 10 caractères.</p>

  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}
  {#if done}
    <p class="done" role="status">{doneMessage}</p>
  {/if}

  <button type="submit" class="btn btn-primary" disabled={busy}>{submitLabel}</button>
</form>

<style>
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

  .done {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--ok-soft);
    color: var(--ok);
    font-size: 13px;
    font-weight: 600;
  }
</style>
