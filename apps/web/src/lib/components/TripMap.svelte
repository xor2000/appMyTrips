<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
  import type { MapPoint } from '#lib/map/points.ts';
  import { styleFor, type MapStyleId } from '#lib/map/styles.ts';

  interface Props {
    points?: MapPoint[];
    /** Clé de l'élément survolé (timeline ou carte). */
    highlighted?: string | null;
    /** Change quand la vue doit se recadrer sur les points (changement de jour…). */
    fitKey?: string;
    onHover?: (key: string | null) => void;
    onPick?: (point: MapPoint) => void;
    /** Clic droit → « Ajouter ici » ; absent en lecture seule. */
    onAddHere?: (point: { lat: number; lng: number }) => void;
    onCenterChange?: (center: { lat: number; lng: number }) => void;
  }

  let {
    points = [],
    highlighted = null,
    fitKey = '',
    onHover = () => {},
    onPick = () => {},
    onAddHere,
    onCenterChange = () => {},
  }: Props = $props();

  let container: HTMLDivElement;
  let map = $state<MapLibreMap | undefined>();
  let MarkerClass: typeof Marker | undefined;
  let LngLatBoundsClass: typeof import('maplibre-gl').LngLatBounds | undefined;
  let styleId = $state<MapStyleId>('plan');
  let menu = $state<{ x: number; y: number; lat: number; lng: number } | null>(null);
  // Cache des marqueurs MapLibre, volontairement non réactif (mis à jour par les effets).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const markers = new Map<string, { marker: Marker; el: HTMLElement }>();
  let lastFit = '';

  onMount(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;

    Promise.all([
      import('maplibre-gl'),
      // MapLibre 6 cherche son worker à côté de son module, ce que le bundling casse :
      // on fait émettre le fichier par Vite et on lui donne son URL.
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
    ]).then(([lib, worker]) => {
      if (disposed) return;
      lib.setWorkerUrl(worker.default);
      MarkerClass = lib.Marker;
      LngLatBoundsClass = lib.LngLatBounds;
      const m = new lib.Map({
        container,
        style: styleFor(styleId),
        // Vue d'ensemble de l'Europe tant que le voyage n'a pas d'étapes.
        center: [8, 47],
        zoom: 4,
        attributionControl: false,
      });
      m.addControl(new lib.NavigationControl({ showCompass: false }), 'bottom-right');
      m.addControl(new lib.AttributionControl({ compact: true }), 'bottom-left');
      m.on('contextmenu', (e) => {
        if (!onAddHere) return;
        menu = { x: e.point.x, y: e.point.y, lat: e.lngLat.lat, lng: e.lngLat.lng };
      });
      m.on('movestart', () => (menu = null));
      m.on('moveend', () => {
        const c = m.getCenter();
        onCenterChange({ lat: c.lat, lng: c.lng });
      });
      // Le panneau gauche est redimensionnable : la carte suit la taille de son conteneur.
      observer = new ResizeObserver(() => m.resize());
      observer.observe(container);
      map = m;
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
    };
  });

  // Synchronise les marqueurs avec les points.
  $effect(() => {
    const m = map;
    if (!m || !MarkerClass) return;
    const wanted = new Set(points.map((p) => p.key));
    for (const [key, { marker }] of markers) {
      if (!wanted.has(key)) {
        marker.remove();
        markers.delete(key);
      }
    }
    for (const p of points) {
      let entry = markers.get(p.key);
      if (!entry) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'map-marker';
        el.addEventListener('mouseenter', () => onHover(p.key));
        el.addEventListener('mouseleave', () => onHover(null));
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onPick(p);
        });
        entry = {
          el,
          marker: new MarkerClass({ element: el, anchor: 'bottom' })
            .setLngLat([p.lng, p.lat])
            .addTo(m),
        };
        markers.set(p.key, entry);
      }
      entry.marker.setLngLat([p.lng, p.lat]);
      entry.el.textContent = p.label;
      entry.el.title = p.name;
      entry.el.setAttribute('aria-label', `${p.label} · ${p.name}`);
      entry.el.style.setProperty('--c', `var(${p.color})`);
      entry.el.classList.toggle('faded', p.faded);
    }
  });

  // Mise en évidence du point survolé.
  $effect(() => {
    for (const [key, { el }] of markers) el.classList.toggle('highlighted', key === highlighted);
  });

  // Recadrage sur les points quand la vue change (jour sélectionné, ajout du premier point…).
  $effect(() => {
    const m = map;
    const key = `${fitKey}|${points.length}`;
    if (!m || !LngLatBoundsClass || key === lastFit) return;
    lastFit = key;
    if (points.length === 0) return;
    if (points.length === 1) {
      m.easeTo({ center: [points[0]!.lng, points[0]!.lat], zoom: Math.max(m.getZoom(), 13) });
      return;
    }
    const bounds = new LngLatBoundsClass();
    for (const p of points) bounds.extend([p.lng, p.lat]);
    m.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
  });

  function selectStyle(id: MapStyleId) {
    if (id === styleId) return;
    styleId = id;
    map?.setStyle(styleFor(id));
  }

  function addHere() {
    if (menu && onAddHere) onAddHere({ lat: menu.lat, lng: menu.lng });
    menu = null;
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
  {#if menu}
    <div class="menu" style={`left: ${menu.x}px; top: ${menu.y}px`}>
      <button type="button" onclick={addHere}>Ajouter ici</button>
    </div>
  {/if}
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

  .menu {
    position: absolute;
    z-index: 5;
    transform: translate(4px, 4px);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-float);
  }

  .menu button {
    border: 0;
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    background: transparent;
    color: var(--fg);
    font: 600 13px var(--font-display);
    cursor: pointer;
  }

  .menu button:hover {
    background: var(--surface-2);
  }

  /* Marqueurs créés par MapLibre hors du composant : styles globaux. */
  :global(.map-marker) {
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border: 2px solid #fff;
    border-radius: 15px 15px 15px 4px;
    background: var(--c);
    color: #fff;
    font: 700 12px var(--font-display);
    box-shadow: 0 3px 8px -2px rgb(0 0 0 / 35%);
    cursor: pointer;
    transition: transform 0.12s;
  }

  :global(.map-marker.highlighted) {
    transform: scale(1.25);
    z-index: 2;
  }

  :global(.map-marker.faded) {
    opacity: 0.45;
  }
</style>
