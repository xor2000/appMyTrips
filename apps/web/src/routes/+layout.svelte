<script lang="ts">
  import '@fontsource-variable/outfit';
  import '@fontsource-variable/inter';
  import '@fontsource-variable/jetbrains-mono';
  import '#lib/styles/global.css';
  import '#lib/styles/controls.css';
  import { onMount, type Snippet } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import AppHeader from '#lib/components/AppHeader.svelte';
  import UpdatePrompt from '#lib/components/UpdatePrompt.svelte';
  import { fetchSession, setUnauthorizedHandler } from '#lib/api.ts';
  import { isPublicPath, loginUrl } from '#lib/auth/next.ts';
  import { session } from '#lib/auth/session.svelte.ts';
  import { pageHeader } from '#lib/page-header.svelte.ts';

  let { children }: { children: Snippet } = $props();

  let needRefresh = $state(false);
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

  /** Session absente ou expirée : vers la connexion, en gardant la page où revenir. */
  function toLogin() {
    session.me = null;
    const { pathname, search } = page.url;
    if (isPublicPath(pathname)) return;
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- chemin interne vérifié par loginUrl
    goto(loginUrl(pathname + search), { replaceState: true });
  }

  onMount(() => {
    setUnauthorizedHandler(toLogin);
    // Hors ligne (état inconnu), on reste sur la page : les copies restent consultables.
    fetchSession().then((s) => {
      if (s.state === 'signed-in') session.me = s.me;
      else if (s.state === 'signed-out') toLogin();
    });

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
    return () => setUnauthorizedHandler(null);
  });
</script>

<div class="app">
  <AppHeader me={session.me} content={pageHeader.content} />
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
