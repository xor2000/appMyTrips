<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    left: Snippet;
    right: Snippet;
    /** Clé localStorage pour mémoriser la largeur du panneau gauche. */
    storageKey?: string;
  }

  let { left, right, storageKey = 'mytrips.splitWidth' }: Props = $props();

  const MIN = 320;
  const MAX = 720;
  let width = $state(420);
  let dragging = $state(false);

  const clamp = (w: number) => Math.min(MAX, Math.max(MIN, Math.round(w)));

  onMount(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved) width = clamp(saved);
    } catch {
      // Stockage indisponible : largeur par défaut.
    }
  });

  function save() {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // Stockage indisponible : la largeur n'est simplement pas mémorisée.
    }
  }

  function onPointerDown(event: PointerEvent) {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    const root = (event.currentTarget as HTMLElement).parentElement!;
    width = clamp(event.clientX - root.getBoundingClientRect().left);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    save();
  }

  function onKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft') width = clamp(width - step);
    else if (event.key === 'ArrowRight') width = clamp(width + step);
    else return;
    event.preventDefault();
    save();
  }
</script>

<div class="split" class:dragging style={`--left: ${width}px`}>
  <div class="left">{@render left()}</div>
  <!-- Séparateur focalisable (motif ARIA « window splitter ») : clavier et souris attendus. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="handle"
    role="separator"
    aria-orientation="vertical"
    aria-label="Largeur du panneau"
    aria-valuemin={MIN}
    aria-valuemax={MAX}
    aria-valuenow={width}
    tabindex="0"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onkeydown={onKeydown}
  ></div>
  <div class="right">{@render right()}</div>
</div>

<style>
  .split {
    display: grid;
    grid-template-columns: var(--left) 6px 1fr;
    height: 100%;
    min-height: 0;
  }

  .split.dragging {
    user-select: none;
    cursor: col-resize;
  }

  .left,
  .right {
    min-width: 0;
    min-height: 0;
  }

  .left {
    overflow: auto;
    background: var(--surface);
  }

  .handle {
    cursor: col-resize;
    /* Filet d'1 px comme sur la maquette, dans une poignée de 6 px facile à saisir. */
    background: linear-gradient(var(--line), var(--line)) center / 1px 100% no-repeat var(--surface);
    transition: background-color 0.15s;
  }

  .handle:hover,
  .handle:focus-visible,
  .dragging .handle {
    background: var(--accent);
  }
</style>
