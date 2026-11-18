<script lang="ts">
  import type { Me } from '@mytrips/core';
  import type { Snippet } from 'svelte';
  import { resolve } from '$app/paths';
  import ProfileMenu from './ProfileMenu.svelte';

  interface Props {
    /** Utilisateur connecté, s'il est connu. */
    me?: Me | null;
    /**
     * Contenu propre à la page, placé sur la même ligne entre le logo et le profil
     * (titre et actions d'un voyage, voir `lib/page-header.svelte.ts`).
     */
    content?: Snippet | null;
  }

  let { me = null, content = null }: Props = $props();
</script>

<header class="app-header" class:with-content={!!content}>
  <a class="brand" href={resolve('/')} aria-label="MyTrips, accueil">
    <img src="/favicon.svg" alt="" width="32" height="32" />
  </a>
  <div class="content">
    {@render content?.()}
  </div>
  {#if me}
    <ProfileMenu {me} />
  {/if}
</header>

<style>
  .app-header {
    /* Au-dessus de la page (carte comprise) pour le menu du profil, sous les fenêtres modales. */
    position: relative;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-6);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  /* Le contenu de la page continue sous la ligne (onglets des jours) : pas de séparation. */
  .app-header.with-content {
    padding-top: var(--space-3);
    padding-bottom: 0;
    border-bottom: 0;
  }

  .brand {
    display: inline-flex;
    flex: none;
  }

  .brand img {
    border-radius: 10px;
  }

  .content {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
  }

  @media (max-width: 640px) {
    .app-header {
      padding-inline: var(--space-4);
    }

    /* Le contenu de la page se répartit sur la ligne du logo et du profil, et peut passer à la
       ligne (la page voyage y envoie ses actions, voir son style). */
    .app-header.with-content {
      flex-wrap: wrap;
      row-gap: var(--space-2);
    }

    .with-content .content {
      display: contents;
    }
  }
</style>
