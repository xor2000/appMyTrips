<script lang="ts">
  import { Email, type Member, type Role } from '@mytrips/core';
  import Modal from './Modal.svelte';

  interface Props {
    members: Member[];
    onAdd: (email: string, role: Role) => Promise<void>;
    onRemove: (email: string) => Promise<void>;
    onClose: () => void;
  }

  let { members, onAdd, onRemove, onClose }: Props = $props();

  const roleLabels: Record<Role, string> = { editor: 'Modification', viewer: 'Lecture seule' };

  let email = $state('');
  let role = $state<Role>('viewer');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function invite(event: SubmitEvent) {
    event.preventDefault();
    const parsed = Email.safeParse(email);
    if (!parsed.success) {
      error = 'E-mail invalide.';
      return;
    }
    error = null;
    busy = true;
    try {
      await onAdd(parsed.data, role);
      email = '';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function remove(memberEmail: string) {
    error = null;
    try {
      await onRemove(memberEmail);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<Modal title="Partager le voyage" {onClose}>
  {#if members.length === 0}
    <p class="empty">Ce voyage n’est partagé avec personne.</p>
  {:else}
    <ul class="members">
      {#each members as m (m.email)}
        <li>
          <span class="email">{m.email}</span>
          <span class="chip role">{roleLabels[m.role]}</span>
          <button
            type="button"
            class="btn btn-ghost remove"
            aria-label={`Retirer ${m.email}`}
            onclick={() => remove(m.email)}>Retirer</button
          >
        </li>
      {/each}
    </ul>
  {/if}

  <form class="invite" onsubmit={invite} novalidate>
    <label class="field grow">
      E-mail
      <input type="email" bind:value={email} placeholder="ami@exemple.fr" autocomplete="off" />
    </label>
    <label class="field">
      Rôle
      <select bind:value={role}>
        <option value="viewer">Peut consulter</option>
        <option value="editor">Peut modifier</option>
      </select>
    </label>
    <button type="submit" class="btn btn-primary" disabled={busy}>Inviter</button>
  </form>

  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  <p class="note">
    L’invité doit aussi figurer dans la liste des personnes autorisées par Cloudflare Access pour
    ouvrir l’application.
  </p>

  {#snippet actions()}
    <button type="button" class="btn btn-soft" onclick={onClose}>Fermer</button>
  {/snippet}
</Modal>

<style>
  .empty,
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .members {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .members li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .email {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .role {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .remove {
    min-height: 30px;
    font-size: 13px;
  }

  .invite {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .grow {
    flex: 1;
    min-width: 180px;
  }
</style>
