<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import { STEP_TYPE_INFO, type Poi } from '@mytrips/core';
  import CloudDownload from 'lucide-svelte/icons/cloud-download';
  import Compass from 'lucide-svelte/icons/compass';
  import Search from 'lucide-svelte/icons/search';
  import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
  import type { MapView } from '#lib/api.ts';
  import type { LegLine } from '#lib/legs/legs.ts';
  import type { MapPoint } from '#lib/map/points.ts';
  import {
    guardMissingNumbers,
    missingImageResolver,
    styleFor,
    type MapStyleId,
  } from '#lib/map/styles.ts';

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
    /** Zone visible et zoom, au chargement puis après chaque déplacement. */
    onViewChange?: (view: MapView) => void;
    /** Lieux de la découverte (marqueurs atténués, distincts des étapes). */
    pois?: Poi[];
    selectedPoi?: string | null;
    hoveredPoi?: string | null;
    onPickPoi?: (poi: Poi) => void;
    onHoverPoi?: (id: string | null) => void;
    /** Mode « Explorer » ; le bouton n'apparaît que si `onToggleExplore` est fourni. */
    exploring?: boolean;
    onToggleExplore?: () => void;
    /** « Préparer hors ligne » dans les outils de la carte (absent si non fourni). */
    onOffline?: () => void;
    /** Champ « Rechercher un lieu » flottant : ouvre l'ajout de lieu (absent si non fourni). */
    onSearch?: () => void;
    /** Tracés des trajets du jour, colorés par mode ; `highlighted` met en évidence leur clé. */
    lines?: LegLine[];
  }

  let {
    points = [],
    highlighted = null,
    fitKey = '',
    onHover = () => {},
    onPick = () => {},
    onAddHere,
    onViewChange = () => {},
    pois = [],
    selectedPoi = null,
    hoveredPoi = null,
    onPickPoi = () => {},
    onHoverPoi = () => {},
    exploring = false,
    onToggleExplore,
    onOffline,
    onSearch,
    lines = [],
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
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const poiMarkers = new Map<string, { marker: Marker; el: HTMLElement }>();
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
        // Appliquée aussi aux setStyle suivants (changement de fond).
        transformStyle: guardMissingNumbers,
        // Vue d'ensemble de l'Europe tant que le voyage n'a pas d'étapes.
        center: [8, 47],
        zoom: 4,
        attributionControl: false,
      });
      m.setMissingStyleImageResolver(missingImageResolver(m));
      m.addControl(new lib.NavigationControl({ showCompass: false }), 'bottom-right');
      m.addControl(
        new lib.AttributionControl({
          compact: true,
          // Mentions exigées par les services de routage (politiques d'usage d'ORS et Transitous).
          customAttribution: [
            'Itinéraires © <a href="https://openrouteservice.org/" target="_blank" rel="noopener">openrouteservice.org</a> (HeiGIT)',
            'Transports en commun : <a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous</a>',
          ],
        }),
        'bottom-left',
      );
      m.on('contextmenu', (e) => {
        if (!onAddHere) return;
        menu = { x: e.point.x, y: e.point.y, lat: e.lngLat.lat, lng: e.lngLat.lng };
      });
      m.on('movestart', () => (menu = null));
      const emitView = () => {
        const b = m.getBounds();
        onViewChange({
          bbox: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
          zoom: m.getZoom(),
        });
      };
      m.on('load', emitView);
      m.on('moveend', emitView);
      // Un changement de fond (setStyle) efface les sources : on remet les tracés.
      m.on('style.load', () => syncLines(m));
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
      // Idée : ampoule plutôt que du texte (le nom accessible garde « Idée · … »).
      if (p.idea) entry.el.replaceChildren(lightbulbIcon());
      else entry.el.textContent = p.label;
      entry.el.title = p.name;
      entry.el.setAttribute('aria-label', `${p.label} · ${p.name}`);
      entry.el.style.setProperty('--c', `var(${p.color})`);
      entry.el.classList.toggle('faded', p.faded);
      entry.el.classList.toggle('idea', p.idea);
    }
  });

  /** Icône lucide « lightbulb » (marqueurs créés hors des composants Svelte). */
  function lightbulbIcon(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of [
      'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
      'M9 18h6',
      'M10 22h4',
    ]) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  /** Couleur réelle d'une variable CSS (MapLibre ne lit pas les variables). */
  function cssColor(name: string) {
    const style = getComputedStyle(container);
    return style.getPropertyValue(name).trim() || style.getPropertyValue('--muted').trim();
  }

  /** Met à jour (ou crée) la source et les couches des tracés de trajets. */
  function syncLines(m: MapLibreMap) {
    if (!m.isStyleLoaded()) return;
    const data: Parameters<import('maplibre-gl').GeoJSONSource['setData']>[0] = {
      type: 'FeatureCollection',
      features: lines.map((l) => ({
        type: 'Feature',
        properties: {
          key: l.key,
          color: cssColor(l.color),
          dashed: l.dashed,
          highlighted: l.key === highlighted,
        },
        geometry: { type: 'LineString', coordinates: l.coordinates },
      })),
    };
    const source = m.getSource('legs') as import('maplibre-gl').GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    m.addSource('legs', { type: 'geojson', data });
    const paint: import('maplibre-gl').LineLayerSpecification['paint'] = {
      'line-color': ['get', 'color'],
      'line-width': ['case', ['get', 'highlighted'], 7, 4],
      'line-opacity': ['case', ['get', 'highlighted'], 1, 0.8],
    };
    m.addLayer({
      id: 'legs',
      type: 'line',
      source: 'legs',
      filter: ['!', ['get', 'dashed']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint,
    });
    m.addLayer({
      id: 'legs-dashed',
      type: 'line',
      source: 'legs',
      filter: ['get', 'dashed'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { ...paint, 'line-dasharray': [1, 1.6] },
    });
  }

  // Tracés des trajets (et mise en évidence au survol de leur tuile).
  $effect(() => {
    const m = map;
    void lines;
    void highlighted;
    if (m) syncLines(m);
  });

  // Synchronise les marqueurs des lieux de la découverte.
  $effect(() => {
    const m = map;
    if (!m || !MarkerClass) return;
    const wanted = new Map(pois.map((p) => [p.id, p]));
    for (const [id, { marker }] of poiMarkers) {
      if (!wanted.has(id)) {
        marker.remove();
        poiMarkers.delete(id);
      }
    }
    for (const p of pois) {
      if (poiMarkers.has(p.id)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'poi-marker';
      el.title = p.name;
      el.setAttribute('aria-label', `Lieu proposé : ${p.name}`);
      el.style.setProperty('--c', `var(${STEP_TYPE_INFO[p.stepType].color})`);
      el.addEventListener('mouseenter', () => onHoverPoi(p.id));
      el.addEventListener('mouseleave', () => onHoverPoi(null));
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onPickPoi(p);
      });
      poiMarkers.set(p.id, {
        el,
        marker: new MarkerClass({ element: el }).setLngLat([p.lng, p.lat]).addTo(m),
      });
    }
  });

  // Lieu de la découverte sélectionné ou survolé.
  $effect(() => {
    for (const [id, { el }] of poiMarkers) {
      el.classList.toggle('active', id === selectedPoi || id === hoveredPoi);
    }
  });

  // Mise en évidence du point survolé.
  $effect(() => {
    for (const [key, { el }] of markers) el.classList.toggle('highlighted', key === highlighted);
  });

  // Recadrage sur les points quand la vue change (jour sélectionné, ajout du premier point…).
  $effect(() => {
    const m = map;
    // Cadrage sur les étapes placées ; les idées ne servent que s'il n'y a rien d'autre.
    const placed = points.filter((p) => !p.idea);
    const framed = placed.length > 0 ? placed : points;
    const key = `${fitKey}|${framed.length}`;
    if (!m || !LngLatBoundsClass || key === lastFit) return;
    lastFit = key;
    if (framed.length === 0) return;
    if (framed.length === 1) {
      m.easeTo({ center: [framed[0]!.lng, framed[0]!.lat], zoom: Math.max(m.getZoom(), 13) });
      return;
    }
    const bounds = new LngLatBoundsClass();
    for (const p of framed) bounds.extend([p.lng, p.lat]);
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

<!-- data-leg-lines : nombre de tracés (le canevas WebGL n'est pas lisible par les e2e). -->
<div class="map-wrap" data-testid="trip-map" data-leg-lines={lines.length}>
  <div class="map" bind:this={container}></div>
  {#if onSearch && !exploring}
    <button type="button" class="search" onclick={onSearch}>
      <Search size={15} />Rechercher un lieu, une adresse…
    </button>
  {/if}
  <!-- Outils regroupés dans une seule pilule, comme sur la maquette. -->
  <div class="tools">
    <div class="styles" role="group" aria-label="Fond de carte">
      <button type="button" aria-pressed={styleId === 'plan'} onclick={() => selectStyle('plan')}>
        Plan
      </button>
      <button type="button" aria-pressed={styleId === 'topo'} onclick={() => selectStyle('topo')}>
        Topo
      </button>
    </div>
    {#if onToggleExplore || onOffline}
      <span class="sep" aria-hidden="true"></span>
    {/if}
    {#if onToggleExplore}
      <button type="button" class="tool" aria-pressed={exploring} onclick={onToggleExplore}>
        <Compass size={15} />Explorer
      </button>
    {/if}
    {#if onOffline}
      <button
        type="button"
        class="tool icon"
        aria-label="Préparer hors ligne"
        title="Préparer hors ligne"
        onclick={onOffline}><CloudDownload size={15} /></button
      >
    {/if}
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

  .tools {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 5px;
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-float);
  }

  .styles {
    display: flex;
    gap: var(--space-1);
  }

  .styles button,
  .tool {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: 28px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    font: 600 12px var(--font-display);
    cursor: pointer;
  }

  .styles button:hover,
  .tool:hover {
    color: var(--fg);
  }

  .styles button[aria-pressed='true'],
  .tool[aria-pressed='true'] {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .tool.icon {
    width: 28px;
    justify-content: center;
    padding: 0;
  }

  .sep {
    align-self: stretch;
    width: 1px;
    margin: 3px 2px;
    background: var(--line);
  }

  .search {
    position: absolute;
    top: 14px;
    left: 14px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: min(360px, calc(100% - 300px));
    min-width: 160px;
    padding: 9px 14px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-float);
    color: var(--muted);
    font: 400 13px var(--font-body);
    text-align: left;
    cursor: text;
    overflow: hidden;
    white-space: nowrap;
  }

  .search:hover {
    color: var(--fg);
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
    /* Au-dessus des lieux proposés par la découverte. */
    z-index: 1;
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border: 2px solid var(--marker-ring);
    border-radius: 15px 15px 15px 4px;
    background: var(--c);
    color: var(--on-type);
    font: 700 12px var(--font-display);
    box-shadow: var(--shadow-marker);
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

  /* Idée (pas encore placée) : marqueur clair à contour pointillé, sans numéro, sous les étapes. */
  :global(.map-marker.idea) {
    z-index: 0;
    border: 2px dashed var(--c);
    background: var(--surface);
    color: var(--c);
  }

  /* Lieux proposés : petites pastilles atténuées, sous les étapes du voyage. */
  :global(.poi-marker) {
    width: 16px;
    height: 16px;
    padding: 0;
    border: 2px solid var(--surface);
    border-radius: 50%;
    background: color-mix(in srgb, var(--c) 55%, var(--surface));
    box-shadow: var(--shadow-marker);
    cursor: pointer;
    transition: transform 0.12s;
  }

  :global(.poi-marker.active) {
    background: var(--c);
    transform: scale(1.5);
    z-index: 1;
  }
</style>
