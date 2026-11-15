<script lang="ts">
  import '@fontsource-variable/outfit';
  import '@fontsource-variable/inter';
  import '#lib/styles/global.css';
  import { onMount, type Snippet } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';
  import AppHeader from '#lib/components/AppHeader.svelte';
  import UpdatePrompt from '#lib/components/UpdatePrompt.svelte';
  import { fetchMe } from '#lib/api.ts';

  let { children }: { children: Snippet } = $props();

  let userEmail = $state<string | null>(null);
  let needRefresh = $state(false);
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

  onMount(() => {
    fetchMe().then((me) => (userEmail = me?.email ?? null));

    // Enregistrement du service worker (build uniquement : pwaInfo est indéfini en dev),
    // avec invite de mise à jour. Le manifeste est lié en dur dans app.html.
    if (pwaInfo) {
      import('virtual:pwa-register').then(({ registerSW }) => {
        updateSW = registerSW({
          immediate: true,
          onNeedRefresh: () => (needRefresh = true),
        });
      });
    }
  });
</script>

<AppHeader {userEmail} />

<main>
  {@render children()}
</main>

<UpdatePrompt
  {needRefresh}
  onReload={() => updateSW?.(true)}
  onDismiss={() => (needRefresh = false)}
/>

<style>
  main {
    padding: var(--space-8) var(--space-6);
    max-width: 1200px;
    margin: 0 auto;
  }
</style>
