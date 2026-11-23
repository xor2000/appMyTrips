<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import { STEP_TYPE_INFO, type Poi } from '@mytrips/core';
  import CloudDownload from 'lucide-svelte/icons/cloud-download';
  import Compass from 'lucide-svelte/icons/compass';
  import Search from 'lucide-svelte/icons/search';
  import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
  import type { MapView } from '#lib/api.ts';
  import type { LegLine } from '#lib/legs/legs.ts';
  import type { MapPoint } from '#lib/map/points.ts';
  import BasemapPicker from './BasemapPicker.svelte';
  import {
    closestPoiId,
    POI_HIT_TOLERANCE_PX,
    POI_LAYER,
    POI_SOURCE,
    poiFeatureCollection,
    poiLayer,
  } from '#lib/map/pois.ts';
  import {
    missingImageResolver,
    styleFor,
    transformFor,
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
  let PopupClass: typeof Popup | undefined;
  /** Infobulle du lieu de la découverte sélectionné. */
  let poiPopup: Popup | undefined;
  /** Lieux portant l'état `active` (survolé ou sélectionné) dans la source des lieux. */
  let activePois: string[] = [];
  /** Synchronisations reportées à la fin du chargement des tuiles (voir `whenStyleReady`). */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const pendingSyncs = new Set<string>();
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
      PopupClass = lib.Popup;
      LngLatBoundsClass = lib.LngLatBounds;
      const m = new lib.Map({
        container,
        style: styleFor(styleId),
        transformStyle: transformFor(styleId),
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
      // Un changement de fond (setStyle) efface les sources : on remet les tracés et les lieux.
      m.on('style.load', () => {
        syncLines(m);
        syncPois(m);
      });
      // Lieux de la découverte : survol, et clic au plus près (marge de quelques pixels).
      m.on('mousemove', POI_LAYER, (e) => {
        m.getCanvas().style.cursor = 'pointer';
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') onHoverPoi(id);
      });
      m.on('mouseleave', POI_LAYER, () => {
        m.getCanvas().style.cursor = '';
        onHoverPoi(null);
      });
      m.on('click', (e) => {
        if (!m.getLayer(POI_LAYER)) return;
        const { x, y } = e.point;
        const t = POI_HIT_TOLERANCE_PX;
        const hits = m
          .queryRenderedFeatures(
            [
              [x - t, y - t],
              [x + t, y + t],
            ],
            { layers: [POI_LAYER] },
          )
          .flatMap((f) =>
            f.geometry.type === 'Point'
              ? [
                  {
                    id: String(f.properties?.id),
                    lng: f.geometry.coordinates[0]!,
                    lat: f.geometry.coordinates[1]!,
                  },
                ]
              : [],
          );
        const id = closestPoiId(hits, e.point, (ll) => m.project(ll));
        const poi = id ? pois.find((p) => p.id === id) : undefined;
        if (poi) onPickPoi(poi);
      });
      exposeForTests(m);
      // Le panneau gauche est redimensionnable : la carte suit la taille de son conteneur.
      observer = new ResizeObserver(() => m.resize());
      observer.observe(container);
      map = m;
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      poiPopup?.remove();
      map?.remove();
      const testWindow = window as unknown as Record<string, unknown>;
      delete testWindow.__mapPoisForTests;
      delete testWindow.__mapProjectForTests;
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

  /**
   * Lance `run` tout de suite si le style est prêt, sinon une seule fois à la fin du chargement.
   * `isStyleLoaded()` reste faux tant que des tuiles chargent : sans ce report, une mise à jour
   * arrivée pendant un déplacement de la carte était perdue jusqu'au changement suivant.
   */
  function whenStyleReady(m: MapLibreMap, key: string, run: () => void) {
    if (m.isStyleLoaded()) {
      run();
      return;
    }
    if (pendingSyncs.has(key)) return;
    pendingSyncs.add(key);
    m.once('idle', () => {
      pendingSyncs.delete(key);
      run();
    });
  }

  /** Met à jour (ou crée) la source et les couches des tracés de trajets. */
  function syncLines(m: MapLibreMap) {
    whenStyleReady(m, 'lines', () => applyLines(m));
  }

  function applyLines(m: MapLibreMap) {
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

  /** Met à jour (ou crée) la source et la couche des lieux de la découverte. */
  function syncPois(m: MapLibreMap) {
    whenStyleReady(m, 'pois', () => applyPois(m));
  }

  function applyPois(m: MapLibreMap) {
    const data = poiFeatureCollection(pois, (p) => cssColor(STEP_TYPE_INFO[p.stepType].color));
    const source = m.getSource(POI_SOURCE) as import('maplibre-gl').GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      // `promoteId` : l'identifiant du lieu sert d'identifiant à l'état `active`.
      m.addSource(POI_SOURCE, { type: 'geojson', data, promoteId: 'id' });
      m.addLayer(poiLayer(cssColor('--marker-ring')));
    }
    // Nouvelles données ou nouveau fond : on repart d'aucun état, puis on repose les bons.
    m.removeFeatureState({ source: POI_SOURCE });
    activePois = [];
    applyActivePois(m);
  }

  /** Pose l'état `active` sur le lieu sélectionné et le lieu survolé, et seulement eux. */
  function applyActivePois(m: MapLibreMap) {
    if (!m.getSource(POI_SOURCE)) return;
    const known = new Set(pois.map((p) => p.id));
    const wanted = [selectedPoi, hoveredPoi].filter(
      (id): id is string => id !== null && known.has(id),
    );
    for (const id of activePois) {
      if (!wanted.includes(id)) m.setFeatureState({ source: POI_SOURCE, id }, { active: false });
    }
    for (const id of wanted) m.setFeatureState({ source: POI_SOURCE, id }, { active: true });
    activePois = wanted;
  }

  // Lieux de la découverte.
  $effect(() => {
    const m = map;
    void pois;
    if (m) syncPois(m);
  });

  // Lieu de la découverte sélectionné ou survolé.
  $effect(() => {
    const m = map;
    void selectedPoi;
    void hoveredPoi;
    if (m) applyActivePois(m);
  });

  // Infobulle du lieu sélectionné ; la carte se déplace vers lui s'il est hors de la vue.
  $effect(() => {
    const m = map;
    const poi = pois.find((p) => p.id === selectedPoi);
    poiPopup?.remove();
    poiPopup = undefined;
    if (!m || !PopupClass || !poi) return;
    const content = document.createElement('div');
    // textContent : le nom vient d'OpenStreetMap, jamais injecté en HTML.
    content.textContent = poi.name;
    poiPopup = new PopupClass({
      className: 'poi-popup',
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      maxWidth: '240px',
    })
      .setLngLat([poi.lng, poi.lat])
      .setDOMContent(content)
      .addTo(m);
    if (!m.getBounds().contains([poi.lng, poi.lat])) m.easeTo({ center: [poi.lng, poi.lat] });
  });

  /**
   * Accès de test (e2e) : les lieux étant dessinés en WebGL, Playwright ne peut pas les trouver
   * dans le DOM. Sans effet pour l'utilisateur.
   */
  function exposeForTests(m: MapLibreMap) {
    const testWindow = window as unknown as {
      __mapPoisForTests?: () => { id: string; name: string; active: boolean }[];
      __mapProjectForTests?: (lngLat: [number, number]) => { x: number; y: number };
    };
    testWindow.__mapPoisForTests = () => {
      if (!m.getLayer(POI_LAYER)) return [];
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const seen = new Map<string, { id: string; name: string; active: boolean }>();
      for (const f of m.queryRenderedFeatures({ layers: [POI_LAYER] })) {
        const id = String(f.properties?.id);
        seen.set(id, {
          id,
          name: String(f.properties?.name),
          active: m.getFeatureState({ source: POI_SOURCE, id }).active === true,
        });
      }
      return [...seen.values()];
    };
    testWindow.__mapProjectForTests = (lngLat) => {
      const p = m.project(lngLat);
      return { x: p.x, y: p.y };
    };
  }

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
    // Sans diff : plan et satellite partagent le style Liberty, MapLibre appliquerait un diff
    // sans émettre `style.load`, et les tracés et lieux ajoutés par l'appli seraient perdus.
    map?.setStyle(styleFor(id), { diff: false, transformStyle: transformFor(id) });
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
  {#if onToggleExplore || onOffline}
    <!-- Outils regroupés dans une seule pilule, comme sur la maquette. -->
    <div class="tools">
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
  {/if}
  <!-- Fond de carte en bas à droite, au-dessus du zoom, comme sur la maquette de référence. -->
  <div class="basemap">
    <BasemapPicker value={styleId} onSelect={selectStyle} />
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
    /* Largeur de la carte (et non de l'écran) pour placer la recherche (voir plus bas). */
    container-type: inline-size;
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

  /* Au-dessus du zoom de MapLibre (en bas à droite, 29 px par bouton). */
  .basemap {
    position: absolute;
    right: 10px;
    bottom: 84px;
    z-index: 2;
  }

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

  .tool:hover {
    color: var(--fg);
  }

  .tool[aria-pressed='true'] {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .tool.icon {
    width: 28px;
    justify-content: center;
    padding: 0;
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

  /* Carte étroite (mobile) : la pilule d'outils occupe le haut, la recherche passe dessous. */
  @container (max-width: 520px) {
    .search {
      top: 62px;
      right: 14px;
      width: auto;
    }
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
    /* MapLibre place le marqueur par `transform` (style en ligne) : jamais de transition ni de
       `transform` ici, sinon le marqueur traîne derrière la carte. La mise en évidence passe par
       la propriété `scale`, qui se combine avec la position. */
    transform-origin: 50% 100%;
    transition: scale 0.12s;
  }

  :global(.map-marker.highlighted) {
    scale: 1.25;
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

  /* Infobulle du lieu de la découverte sélectionné (lieux dessinés en WebGL, voir lib/map/pois.ts). */
  :global(.poi-popup .maplibregl-popup-content) {
    padding: 6px 10px;
    border-radius: var(--btn-radius);
    background: var(--surface);
    color: var(--fg);
    box-shadow: var(--shadow-marker);
    font: 600 13px var(--font-body);
  }

  :global(.poi-popup .maplibregl-popup-tip) {
    display: none;
  }
</style>
