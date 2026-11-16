<script lang="ts">
  import WifiOff from 'lucide-svelte/icons/wifi-off';

  interface Props {
    /** Date de la copie affichée (ISO), ou null. */
    savedAt: string | null;
  }

  let { savedAt }: Props = $props();

  const date = $derived.by(() => {
    if (!savedAt) return null;
    const d = new Date(savedAt);
    const day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${day} à ${time}`;
  });
  const text = $derived(
    date
      ? `Hors ligne · consultation seule · données du ${date}`
      : 'Hors ligne · consultation seule',
  );
</script>

<p class="offline" role="status">
  <WifiOff size={15} />
  <span>{text}</span>
</p>

<style>
  .offline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 13px;
    font-weight: 600;
  }
</style>
