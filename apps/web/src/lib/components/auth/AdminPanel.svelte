<script lang="ts">
  import { Email } from '@mytrips/core';
  import { onMount } from 'svelte';
  import type { IpBan } from '#lib/api.ts';
  import CopyLink from '../CopyLink.svelte';

  interface Props {
    loadBans: () => Promise<IpBan[]>;
    onUnban: (ip: string) => Promise<void>;
    /** Crée un lien de réinitialisation et renvoie son URL complète. */
    onCreateReset: (email: string) => Promise<string>;
  }

  let { loadBans, onUnban, onCreateReset }: Props = $props();

  let bans = $state<IpBan[] | null>(null);
  let bansError = $state<string | null>(null);
  let email = $state('');
  let resetUrl = $state<string | null>(null);
  let resetError = $state<string | null>(null);
  let busy = $state(false);

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  async function refresh() {
    try {
      bans = await loadBans();
      bansError = null;
    } catch (e) {
      bansError = message(e);
    }
  }

  onMount(refresh);

  async function unban(ip: string) {
    try {
      await onUnban(ip);
      await refresh();
    } catch (e) {
      bansError = message(e);
    }
  }

  async function createReset(event: SubmitEvent) {
    event.preventDefault();
    resetError = null;
    resetUrl = null;
    const parsed = Email.safeParse(email);
    if (!parsed.success) {
      resetError = 'E-mail invalide.';
      return;
    }
    busy = true;
    try {
      resetUrl = await onCreateReset(parsed.data);
    } catch (e) {
      resetError = message(e);
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel">
  <h2>Mot de passe oublié</h2>
  <p class="muted">
    Génère un lien de réinitialisation (valable 24 h, usage unique) à transmettre à la personne.
  </p>
  <form onsubmit={createReset} novalidate>
    <label class="field grow">
      E-mail du compte
      <input type="email" bind:value={email} autocomplete="off" />
    </label>
    <button type="submit" class="btn btn-primary" disabled={busy}>Générer le lien</button>
  </form>
  {#if resetError}
    <p class="form-error" role="alert">{resetError}</p>
  {/if}
  {#if resetUrl}
    <CopyLink label="Lien de réinitialisation" url={resetUrl} />
  {/if}
</section>

<section class="panel">
  <h2>Adresses IP bannies</h2>
  <p class="muted">Bannies après 3 mots de passe faux en 15 minutes, jusqu’à leur réactivation.</p>
  {#if bansError}
    <p class="form-error" role="alert">{bansError}</p>
  {/if}
  {#if bans === null}
    <p class="muted">Chargement…</p>
  {:else if bans.length === 0}
    <p class="muted">Aucune adresse bannie.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Adresse</th>
          <th>Depuis</th>
          <th>E-mail tenté</th>
          <th>Échecs</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each bans as ban (ban.ip)}
          <tr>
            <td class="ip">{ban.ip}</td>
            <td>{formatDate(ban.bannedAt)}</td>
            <td>{ban.lastEmail ?? '—'}</td>
            <td>{ban.failures}</td>
            <td>
              <button
                type="button"
                class="btn btn-soft"
                aria-label={`Réactiver ${ban.ip}`}
                onclick={() => unban(ban.ip)}>Réactiver</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
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

  form {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .grow {
    flex: 1;
    min-width: 220px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    padding: var(--space-2);
    border-bottom: 1px solid var(--line);
    text-align: left;
  }

  th {
    color: var(--muted);
    font-size: 12px;
  }

  .ip {
    font-family: var(--font-mono);
  }
</style>
