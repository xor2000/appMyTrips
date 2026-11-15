<script lang="ts">
  import '@fontsource-variable/outfit';
  import '@fontsource-variable/inter';
  import '#lib/styles/global.css';
  import '#lib/styles/controls.css';
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

<div class="app">
  <AppHeader {userEmail} />
  <main>
    {@render children()}
  </main>
</div>

<UpdatePrompt
  {needRefresh}
  onReload={() => updateSW?.(true)}
  onDismiss={() => (needRefresh = false)}
/>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Chaque page gère sa mise en page : liste centrée, ou écran voyage plein cadre. */
  main {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
