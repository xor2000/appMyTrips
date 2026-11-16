<script lang="ts">
  interface Props {
    /** Libellé accessible du champ. */
    label: string;
    url: string;
  }

  let { label, url }: Props = $props();

  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Presse-papiers refusé : le lien reste sélectionnable dans le champ.
    }
  }
</script>

<div class="copy-link">
  <input
    type="text"
    readonly
    value={url}
    aria-label={label}
    onfocus={(e) => e.currentTarget.select()}
  />
  <button type="button" class="btn btn-soft" onclick={copy}>{copied ? 'Copié' : 'Copier'}</button>
</div>

<style>
  .copy-link {
    display: flex;
    gap: var(--space-2);
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: 38px;
    padding: 0 var(--space-3);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-2);
    color: var(--fg);
    font: 500 13px var(--font-mono);
  }
</style>
