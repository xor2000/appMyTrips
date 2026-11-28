<script lang="ts">
  import { LAYOUTS, type LayoutId } from '#lib/layout.ts';

  interface Props {
    value: LayoutId;
    onChange: (id: LayoutId) => void;
  }

  let { value, onChange }: Props = $props();
</script>

<div class="layouts" role="radiogroup" aria-label="Affichage de la journée">
  {#each LAYOUTS as layout (layout.id)}
    <label class="option" class:checked={value === layout.id}>
      <input
        type="radio"
        name="layout"
        value={layout.id}
        checked={value === layout.id}
        onchange={() => onChange(layout.id)}
      />
      <!-- Schéma de l'affichage : carte (teinte) et journée (traits). -->
      <span class={`sketch ${layout.id}`} aria-hidden="true">
        <i class="map"></i>
        <i class="day"><b></b><b></b><b></b></i>
      </span>
      <span class="text">
        <span class="label">{layout.label}</span>
        <span class="hint">{layout.hint}</span>
      </span>
    </label>
  {/each}
</div>

<style>
  .layouts {
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

  .sketch {
    display: grid;
    gap: 4px;
    height: 56px;
    padding: 6px;
    border-radius: var(--radius-sm);
    background: var(--bg);
  }

  .sketch .map {
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  }

  .sketch .day {
    display: flex;
    gap: 3px;
  }

  .sketch .day b {
    flex: 1;
    border-radius: 3px;
    background: var(--line);
  }

  .sketch.list {
    grid-template-columns: 1fr 1.6fr;
  }

  .sketch.list .day {
    order: -1;
    flex-direction: column;
  }

  .sketch.board .map {
    display: none;
  }

  .sketch.board .day b {
    border-radius: 4px;
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
