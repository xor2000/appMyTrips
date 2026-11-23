<script lang="ts">
  import Download from 'lucide-svelte/icons/download';
  import { onMount } from 'svelte';

  /** Événement `beforeinstallprompt` (Chromium) : installation de la PWA à la demande. */
  type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

  let deferred = $state<InstallEvent | null>(null);

  onMount(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferred = event as InstallEvent;
    };
    const onInstalled = () => (deferred = null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  });

  async function install() {
    const event = deferred;
    if (!event) return;
    deferred = null;
    await event.prompt();
  }
</script>

<!-- Bouton icône de l'en-tête, affiché seulement quand le navigateur propose l'installation. -->
{#if deferred}
  <button
    type="button"
    class="icon-btn"
    aria-label="Installer l’application"
    title="Installer l’application"
    onclick={install}><Download size={18} /></button
  >
{/if}
