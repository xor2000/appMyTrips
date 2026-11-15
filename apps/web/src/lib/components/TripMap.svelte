<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { styleFor, type MapStyleId } from '#lib/map/styles.ts';

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined;
  let styleId = $state<MapStyleId>('plan');

  onMount(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;

    Promise.all([
      import('maplibre-gl'),
      // MapLibre 6 cherche son worker à côté de son module, ce que le bundling casse :
      // on fait émettre le fichier par Vite et on lui donne son URL.
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
    ]).then(([{ Map, NavigationControl, AttributionControl, setWorkerUrl }, worker]) => {
      if (disposed) return;
      setWorkerUrl(worker.default);
      map = new Map({
        container,
        style: styleFor(styleId),
        // Vue d'ensemble de l'Europe tant que le voyage n'a pas d'étapes (lot 2).
        center: [8, 47],
        zoom: 4,
        attributionControl: false,
      });
      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
      // Le panneau gauche est redimensionnable : la carte suit la taille de son conteneur.
      observer = new ResizeObserver(() => map?.resize());
      observer.observe(container);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
    };
  });

  function selectStyle(id: MapStyleId) {
    if (id === styleId) return;
    styleId = id;
    map?.setStyle(styleFor(id));
  }
</script>

<div class="map-wrap">
  <div class="map" bind:this={container}></div>
  <div class="styles" role="group" aria-label="Fond de carte">
    <button type="button" aria-pressed={styleId === 'plan'} onclick={() => selectStyle('plan')}>
      Plan
    </button>
    <button type="button" aria-pressed={styleId === 'topo'} onclick={() => selectStyle('topo')}>
      Topo
    </button>
  </div>
</div>

<style>
  .map-wrap {
    position: relative;
    height: 100%;
    min-height: 0;
  }

  .map {
    position: absolute;
    inset: 0;
    background: var(--surface-2);
  }

  .styles {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--surface);
    box-shadow: var(--shadow-float);
  }

  .styles button {
    border: 0;
    border-radius: var(--radius-pill);
    padding: var(--space-1) var(--space-3);
    background: transparent;
    color: var(--muted);
    font: 600 13px var(--font-display);
    cursor: pointer;
  }

  .styles button[aria-pressed='true'] {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
</style>
