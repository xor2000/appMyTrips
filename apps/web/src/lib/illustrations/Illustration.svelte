<script module lang="ts">
  let scenes: Promise<Record<string, string>> | undefined;

  /**
   * Scènes chargées une seule fois, au premier affichage de l'une d'elles. Un échec (fichier
   * retiré par un nouveau déploiement, hors ligne) n'est pas gardé : l'affichage suivant réessaie.
   */
  export function loadScenes() {
    scenes ??= import('./scenes.ts').then(
      (m) => m.SCENES,
      (error: unknown) => {
        scenes = undefined;
        throw error;
      },
    );
    return scenes;
  }
</script>

<script lang="ts">
  import { illustrationLabel, type IllustrationId } from '@mytrips/core';
  import { PICTOS } from './pictos.ts';

  interface Props {
    id: IllustrationId;
    /** `picto` : vignettes (carré) ; `scene` : grille de choix et aperçu (16:10). */
    variant: 'picto' | 'scene';
    /** Masquée aux lecteurs d'écran (le nom du voyage est écrit à côté). */
    decorative?: boolean;
  }

  let { id, variant, decorative = false }: Props = $props();
</script>

<!-- SVG du dépôt (lib/illustrations), jamais une donnée de l'utilisateur ou de l'API. -->
<span
  class="illu {variant}"
  data-illustration={id}
  role={decorative ? undefined : 'img'}
  aria-label={decorative ? undefined : illustrationLabel(id)}
  aria-hidden={decorative ? 'true' : undefined}
>
  {#if variant === 'picto'}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html PICTOS[id] ?? ''}
  {:else}
    {#await loadScenes() then all}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html all[id] ?? ''}
    {:catch}
      <!-- Scène indisponible : case vide, réessayée au prochain affichage. -->
    {/await}
  {/if}
</span>

<style>
  .illu {
    display: block;
    width: 100%;
    height: 100%;
  }

  .illu.scene {
    aspect-ratio: 16 / 10;
    height: auto;
  }

  .illu :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
