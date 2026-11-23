<script lang="ts">
  import '@fontsource-variable/manrope';
  import '@fontsource-variable/jetbrains-mono';
  import '#lib/styles/global.css';
  import '#lib/styles/controls.css';
  import { onMount, untrack, type Snippet } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import AppHeader from '#lib/components/AppHeader.svelte';
  import TripFormDialog, { type TripFormValues } from '#lib/components/TripFormDialog.svelte';
  import TripSwitcher from '#lib/components/TripSwitcher.svelte';
  import UpdatePrompt from '#lib/components/UpdatePrompt.svelte';
  import { createTrip, fetchSession, setUnauthorizedHandler } from '#lib/api.ts';
  import { isPublicPath, loginUrl } from '#lib/auth/next.ts';
  import { session } from '#lib/auth/session.svelte.ts';
  import { summaryFromSnapshot } from '#lib/home.ts';
  import { connection } from '#lib/offline/connection.svelte.ts';
  import { pageHeader } from '#lib/page-header.svelte.ts';
  import {
    refreshTripList,
    resetTripList,
    tripList,
    upsertTrip,
  } from '#lib/trips/tripList.svelte.ts';

  let { children }: { children: Snippet } = $props();

  let needRefresh = $state(false);
  /** Voyage ouvert (page voyage), pour la liste déroulante de l'en-tête. */
  const currentTripId = $derived(page.route.id === '/trips/[id]' ? (page.params.id ?? null) : null);
  /** Choix du voyage dans l'en-tête : pages du compte, liste connue (session ou copie). */
  const showTrips = $derived(
    !isPublicPath(page.url.pathname) && (session.me !== null || tripList.trips.length > 0),
  );

  // Liste des voyages de l'en-tête, chargée dès que la session est connue (connexion comprise).
  $effect(() => {
    if (session.me) untrack(() => refreshTripList());
  });

  async function createAndOpen(values: TripFormValues) {
    const snapshot = await createTrip(values);
    upsertTrip(summaryFromSnapshot(snapshot));
    tripList.creating = false;
    await goto(resolve('/trips/[id]', { id: snapshot.trip.id }));
  }

  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

  /** Session absente ou expirée : vers la connexion, en gardant la page où revenir. */
  function toLogin() {
    session.me = null;
    // La liste appartient au compte : un autre peut se connecter ensuite sur cet appareil.
    resetTripList();
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
      // Hors ligne : la copie de la liste des voyages reste consultable.
      else refreshTripList();
    });
    // Au retour du réseau : liste fraîche.
    const stopReconnect = connection.onReconnect(() => {
      if (session.me) refreshTripList();
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
    return () => {
      setUnauthorizedHandler(null);
      stopReconnect();
    };
  });
</script>

{#snippet tripSwitcher()}
  <TripSwitcher
    trips={tripList.trips}
    currentId={currentTripId}
    onSelect={(id) => goto(resolve('/trips/[id]', { id }))}
    onSettings={pageHeader.settings ?? undefined}
    onCreate={connection.online ? () => (tripList.creating = true) : undefined}
  />
{/snippet}

<div class="app">
  <AppHeader me={session.me} trips={showTrips ? tripSwitcher : null} content={pageHeader.content} />
  <main>
    {@render children()}
  </main>
</div>

{#if tripList.creating}
  <TripFormDialog onSubmit={createAndOpen} onClose={() => (tripList.creating = false)} />
{/if}

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
