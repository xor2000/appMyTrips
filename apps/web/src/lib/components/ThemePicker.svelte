<script lang="ts">
  import { readTheme, saveTheme, THEME_EVENT, THEMES, type ThemeId } from '#lib/theme.ts';

  let current = $state<ThemeId>(readTheme());

  // Thème choisi ailleurs (menu du profil) pendant que la page est ouverte.
  $effect(() => {
    const follow = (e: Event) => (current = (e as CustomEvent<ThemeId>).detail);
    window.addEventListener(THEME_EVENT, follow);
    return () => window.removeEventListener(THEME_EVENT, follow);
  });

  function choose(id: ThemeId) {
    current = id;
    saveTheme(id);
  }
</script>

{#snippet preview(theme: string)}
  <!-- Aperçu peint avec les variables du thème (data-theme sur l'élément, voir themes/*.css). -->
  <span class="mini" data-theme={theme}>
    <span class="mini-card" style="--c: var(--type-museum)">
      <span class="mini-icon"></span>
      <span class="mini-lines"><i></i><i></i></span>
    </span>
    <span class="mini-leg"></span>
    <span class="mini-accent"></span>
  </span>
{/snippet}

<div class="themes" role="radiogroup" aria-label="Thème">
  {#each THEMES as theme (theme.id)}
    <label class="option" class:checked={current === theme.id}>
      <input
        type="radio"
        name="theme"
        value={theme.id}
        checked={current === theme.id}
        onchange={() => choose(theme.id)}
      />
      <span class="previews" aria-hidden="true">
        {#if theme.id === 'auto'}
          {@render preview('pastel-light')}
          {@render preview('pastel-dark')}
        {:else}
          {@render preview(theme.id)}
        {/if}
      </span>
      <span class="text">
        <span class="label">{theme.label}</span>
        <span class="hint">{theme.hint}</span>
      </span>
    </label>
  {/each}
</div>

<style>
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3);
  }

  .option {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    cursor: pointer;
  }

  .option.checked {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .option:focus-within {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  /* Radio invisible étendu à toute l'option : il reçoit le clic (et reste actionnable en e2e). */
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .previews {
    display: flex;
    gap: var(--space-1);
  }

  .mini {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--bg);
  }

  .mini-card {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px;
    border: var(--card-edge) solid var(--line);
    border-radius: calc(var(--card-radius) / 2);
    background: color-mix(in srgb, var(--c) var(--card-tint), var(--surface));
    box-shadow: 0 1px 0 color-mix(in srgb, var(--c) var(--card-lift), transparent);
  }

  .mini-icon {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: calc(var(--icon-radius) / 2);
    background: color-mix(in srgb, var(--c) var(--icon-tint), transparent);
  }

  .mini-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .mini-lines i {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: var(--fg);
    opacity: 0.7;
  }

  .mini-lines i + i {
    width: 60%;
    background: var(--muted);
  }

  .mini-leg {
    width: 55%;
    height: 7px;
    margin-left: 10px;
    border-radius: var(--leg-radius);
    background: color-mix(in srgb, var(--type-hike) var(--leg-tint), var(--leg-base));
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .mini-accent {
    width: 40%;
    height: 7px;
    border-radius: var(--btn-radius);
    background: var(--accent);
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .label {
    font: 600 14px var(--font-display);
    color: var(--fg);
  }

  .hint {
    font-size: 12px;
    color: var(--muted);
  }
</style>
