<script lang="ts">
  import type { Me } from '@mytrips/core';
  import type { Snippet } from 'svelte';
  import { resolve } from '$app/paths';
  import InstallPrompt from './offline/InstallPrompt.svelte';
  import ProfileMenu from './ProfileMenu.svelte';

  interface Props {
    /** Utilisateur connecté, s'il est connu. */
    me?: Me | null;
    /** Choix du voyage (liste déroulante, paramètres, « + »), juste après le nom de l'appli. */
    trips?: Snippet | null;
    /**
     * Contenu propre à la page, sur la même ligne, entre le choix du voyage et le profil
     * (jours et actions d'un voyage, voir `lib/page-header.svelte.ts`).
     */
    content?: Snippet | null;
  }

  let { me = null, trips = null, content = null }: Props = $props();
</script>

<!-- Une seule ligne compacte, façon maquette de référence. -->
<header class="app-header">
  <a class="brand" href={resolve('/')} aria-label="MyTrips, accueil">
    <img src="/favicon.svg" alt="" width="32" height="32" />
    <strong aria-hidden="true">MyTrips</strong>
  </a>
  {@render trips?.()}
  <div class="content">
    {@render content?.()}
  </div>
  <InstallPrompt />
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
    min-height: 56px;
    padding: 0 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  .brand {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 10px;
    color: var(--fg);
    text-decoration: none;
  }

  .brand img {
    border-radius: 10px;
  }

  .brand strong {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .content {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: var(--space-3);
  }

  /* Tablette : le contenu de la page peut passer à la ligne (la page voyage y envoie ses jours,
     voir son style). */
  @media (max-width: 1024px) {
    .app-header {
      flex-wrap: wrap;
      row-gap: var(--space-2);
      padding-block: var(--space-2);
    }

    .content {
      display: contents;
    }
  }

  /* Petit écran : le nom de l'appli s'efface. */
  @media (max-width: 640px) {
    .brand strong {
      display: none;
    }
  }
</style>
