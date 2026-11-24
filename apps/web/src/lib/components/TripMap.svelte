<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { mount, onMount, unmount, untrack } from 'svelte';
  import { STEP_TYPE_INFO, type Bbox, type Poi } from '@mytrips/core';
  import CloudDownload from 'lucide-svelte/icons/cloud-download';
  import Compass from 'lucide-svelte/icons/compass';
  import Search from 'lucide-svelte/icons/search';
  import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
  import type { MapView } from '#lib/api.ts';
  import type { LegLine } from '#lib/legs/legs.ts';
  import type { MapPoint } from '#lib/map/points.ts';
  import type { FocusTarget, MapPopupContent, PopupTarget } from '#lib/map/popups.ts';
  import BasemapPicker from './BasemapPicker.svelte';
  import MapPopup from './MapPopup.svelte';
  import { BASEMAP_POI_TOLERANCE_PX, basemapPoisClickable } from '#lib/map/basemapPois.ts';
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
    /**
     * Lieux sous un clic sur le fond « Plan OSM France » (ses tuiles sont des images) : la popup
     * du plus proche s'ouvre, comme pour un lieu de la découverte. Absent (hors ligne) : rien.
     */
    findBasemapPois?: (area: Bbox, zoom: number) => Promise<Poi[]>;
    /** Mode « Explorer » ; le bouton n'apparaît que si `onToggleExplore` est fourni. */
    exploring?: boolean;
    onToggleExplore?: () => void;
    /** « Préparer hors ligne » dans les outils de la carte (absent si non fourni). */
    onOffline?: () => void;
    /** Champ « Rechercher un lieu » flottant : ouvre l'ajout de lieu (absent si non fourni). */
    onSearch?: () => void;
    /** Tracés des trajets du jour, colorés par mode ; `highlighted` met en évidence leur clé. */
    lines?: LegLine[];
    /**
     * Contenu de la popup d'un marqueur d'étape ou d'idée, d'un tracé de trajet ou d'un lieu de
     * la découverte, comme sur la maquette de référence ; null : pas de popup (séjour).
     */
    popupFor?: (target: PopupTarget) => MapPopupContent | null;
    /**
     * Demande venue de la colonne : cadrage (zoom 15 au moins sur un lieu, tracé entier pour un
     * trajet) et popup. `seq` change à chaque demande.
     */
    focus?: { target: FocusTarget; seq: number } | null;
    /** La popup s'est fermée (croix, clic sur la carte, action). */
    onPopupClose?: (kind: PopupTarget['kind']) => void;
    /**
     * Choix d'une position (« Choisir sur la carte » de la fenêtre d'un lieu) : bandeau, curseur
     * en croix ; un clic sur la carte donne le point, Échap ou « Annuler » abandonne. Les clics
     * sur les marqueurs, tracés et lieux n'ouvrent alors rien.
     */
    placing?: {
      label: string;
      onPlace: (point: { lat: number; lng: number }) => void;
      onCancel: () => void;
    } | null;
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
    findBasemapPois,
    exploring = false,
    onToggleExplore,
    onOffline,
    onSearch,
    lines = [],
    popupFor = () => null,
    focus = null,
    onPopupClose = () => {},
    placing = null,
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
  /**
   * Popup ouverte (composant Svelte monté dans une popup MapLibre) et ce qu'elle montre.
   * `basemap` : lieu dessiné par le fond, absent de la découverte.
   */
  let popupRef:
    { kind: PopupTarget['kind']; key: string; popup: Popup; basemap: boolean } | undefined;
  /** Change à chaque clic ou déplacement : une recherche de lieu du fond devenue inutile est ignorée. */
  let basemapClick = 0;
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
          // Mentions exigées par les services de routage (politiques d'usage de FOSSGIS et Transitous).
          customAttribution: [
            'Itinéraires : <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS</a> (OSRM), <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">signaler une erreur</a>',
            'Transports en commun : <a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous</a>',
          ],
        }),
        'bottom-left',
      );
      m.on('contextmenu', (e) => {
        if (!onAddHere) return;
        menu = { x: e.point.x, y: e.point.y, lat: e.lngLat.lat, lng: e.lngLat.lng };
      });
      m.on('movestart', () => {
        menu = null;
        basemapClick++;
      });
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
      // Tracés de trajets : curseur et popup au clic (les tracés GPX, clé sans « > », n'en ont pas).
      for (const layer of ['legs', 'legs-dashed']) {
        m.on('mousemove', layer, (e) => {
          const key = e.features?.[0]?.properties?.key;
          if (typeof key === 'string' && key.includes('>')) m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
        m.on('click', layer, (e) => {
          if (placing) return;
          const key = e.features?.[0]?.properties?.key;
          if (typeof key === 'string' && key.includes('>')) {
            openPopup({ kind: 'leg', key }, [e.lngLat.lng, e.lngLat.lat]);
          }
        });
      }
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
        if (placing) {
          placing.onPlace({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          return;
        }
        basemapClick++;
        if (!m.getLayer(POI_LAYER)) {
          void openBasemapPoi(m, e.point);
          return;
        }
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
        if (poi) {
          openPopup({ kind: 'poi', poi }, [poi.lng, poi.lat]);
          onPickPoi(poi);
        } else {
          void openBasemapPoi(m, e.point);
        }
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
      closePopup(false);
      map?.remove();
      const testWindow = window as unknown as Record<string, unknown>;
      delete testWindow.__mapPoisForTests;
      delete testWindow.__mapProjectForTests;
      delete testWindow.__mapZoomForTests;
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
    if (popupRef?.kind === 'step' && !wanted.has(popupRef.key)) closePopup();
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
          if (placing) return;
          // Point à jour (nom, position) : `p` est celui de la création du marqueur.
          const current = points.find((x) => x.key === p.key) ?? p;
          openPopup({ kind: 'step', point: current }, [current.lng, current.lat]);
          onPick(current);
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

  /**
   * Ferme la popup. `notify` : prévenir la page (sélection effacée) ; pas quand une autre popup la
   * remplace, sinon la sélection du nouvel élément serait effacée aussitôt.
   */
  function closePopup(notify = true) {
    const ref = popupRef;
    if (!ref) return;
    if (!notify) popupRef = undefined;
    ref.popup.remove();
  }

  /** Décalage de la popup selon ce qu'elle désigne (marqueur en épingle, pastille, tracé). */
  const POPUP_OFFSET = { step: 36, poi: 14, leg: 8 } as const;

  function targetKey(target: PopupTarget) {
    return target.kind === 'step'
      ? target.point.key
      : target.kind === 'leg'
        ? target.key
        : target.poi.id;
  }

  /**
   * Clic sur le fond « Plan OSM France » : lieux cherchés autour du clic (voir
   * `lib/map/basemapPois.ts`), popup du plus proche. Rien sur un tracé de trajet (il a sa popup),
   * hors ligne, sur un autre fond ou trop loin ; une recherche dépassée par un autre clic, un
   * déplacement ou un changement de fond est ignorée, une erreur aussi (clic sans effet).
   */
  async function openBasemapPoi(m: MapLibreMap, point: { x: number; y: number }) {
    if (!findBasemapPois || !basemapPoisClickable(styleId, m.getZoom())) return;
    const legLayers = ['legs', 'legs-dashed'].filter((id) => m.getLayer(id));
    const onLeg =
      legLayers.length > 0 &&
      m
        .queryRenderedFeatures([point.x, point.y], { layers: legLayers })
        .some((f) => String(f.properties?.key ?? '').includes('>'));
    if (onLeg) return;
    const click = basemapClick;
    const t = BASEMAP_POI_TOLERANCE_PX;
    const sw = m.unproject([point.x - t, point.y + t]);
    const ne = m.unproject([point.x + t, point.y - t]);
    let found: Poi[];
    try {
      found = await findBasemapPois(
        { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat },
        m.getZoom(),
      );
    } catch {
      return;
    }
    if (click !== basemapClick || placing || !basemapPoisClickable(styleId, m.getZoom())) return;
    const id = closestPoiId(found, point, (ll) => m.project(ll));
    const poi = found.find((p) => p.id === id);
    if (poi) openPopup({ kind: 'poi', poi }, [poi.lng, poi.lat], true);
  }

  /** Popup comme la référence : catégorie, nom, notes, infos et actions (voir `lib/map/popups.ts`). */
  function openPopup(target: PopupTarget, lngLat: [number, number], basemap = false) {
    const m = map;
    const content = popupFor(target);
    if (!m || !PopupClass || !content) {
      closePopup();
      return;
    }
    closePopup(false);
    const element = document.createElement('div');
    const component = mount(MapPopup, {
      target: element,
      props: {
        content: {
          ...content,
          // Une action ferme la popup avant d'agir (éditeur, confirmation, ajout).
          actions: content.actions.map((a) => ({
            ...a,
            run: () => {
              closePopup();
              a.run();
            },
          })),
        },
      },
    });
    const popup = new PopupClass({
      className: 'map-popup',
      offset: POPUP_OFFSET[target.kind],
      maxWidth: '290px',
    })
      .setLngLat(lngLat)
      .setDOMContent(element)
      .addTo(m);
    // Fermeture par la croix, un clic sur la carte, une autre popup ou closePopup.
    popup.on('close', () => {
      void unmount(component);
      if (popupRef?.popup !== popup) return;
      popupRef = undefined;
      onPopupClose(target.kind);
    });
    popupRef = { kind: target.kind, key: targetKey(target), popup, basemap };
  }

  // Élément choisi dans la colonne : cadrage comme la référence (`focusPoi`, `focusRoute`) et popup.
  $effect(() => {
    const f = focus;
    const m = map;
    if (!f || !m) return;
    untrack(() => {
      const t = f.target;
      if (t.kind === 'step') {
        const p = points.find((x) => x.key === t.key);
        if (!p) return;
        m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 15), duration: 600 });
        openPopup({ kind: 'step', point: p }, [p.lng, p.lat]);
      } else if (t.kind === 'poi') {
        const poi = pois.find((x) => x.id === t.id);
        if (!poi) return;
        m.flyTo({ center: [poi.lng, poi.lat], zoom: Math.max(m.getZoom(), 15), duration: 600 });
        openPopup({ kind: 'poi', poi }, [poi.lng, poi.lat]);
      } else {
        const line = lines.find((l) => l.key === t.key);
        if (!line || line.coordinates.length === 0 || !LngLatBoundsClass) return;
        const bounds = new LngLatBoundsClass();
        for (const c of line.coordinates) bounds.extend(c);
        m.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 });
        // Popup au milieu du tracé, comme la popup d'une polyligne Leaflet.
        const middle = line.coordinates[Math.floor(line.coordinates.length / 2)]!;
        openPopup({ kind: 'leg', key: t.key }, middle);
      }
    });
  });

  // Popup d'un trajet ou d'un lieu qui n'existe plus (supprimé, autre jour, découverte fermée).
  $effect(() => {
    const ref = popupRef;
    if (ref?.kind === 'leg' && !lines.some((l) => l.key === ref.key)) closePopup();
    if (ref?.kind === 'poi' && !ref.basemap && !pois.some((p) => p.id === ref.key)) closePopup();
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

  /**
   * Accès de test (e2e) : les lieux étant dessinés en WebGL, Playwright ne peut pas les trouver
   * dans le DOM. Sans effet pour l'utilisateur.
   */
  function exposeForTests(m: MapLibreMap) {
    const testWindow = window as unknown as {
      __mapPoisForTests?: () => { id: string; name: string; active: boolean }[];
      __mapProjectForTests?: (lngLat: [number, number]) => { x: number; y: number };
      __mapZoomForTests?: () => number;
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
    testWindow.__mapZoomForTests = () => m.getZoom();
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

<!-- data-leg-lines et data-leg-colors : nombre et couleurs des tracés (le canevas WebGL n'est pas
     lisible par les e2e). -->
<svelte:window
  onkeydown={(e) => {
    if (placing && e.key === 'Escape') {
      // Traité ici : la fenêtre réaffichée par l'abandon ne doit pas se fermer aussi.
      e.preventDefault();
      placing.onCancel();
    }
  }}
/>

<div
  class="map-wrap"
  class:placing={placing !== null}
  data-testid="trip-map"
  data-leg-lines={lines.length}
  data-leg-colors={lines.map((l) => l.color).join(' ')}
>
  <div class="map" bind:this={container}></div>
  {#if placing}
    <!-- Bandeau du choix d'une position, en haut de la carte. -->
    <div class="placing-banner" role="status">
      <span>Cliquez sur la carte pour placer « {placing.label} »</span>
      <button type="button" class="btn btn-ghost" onclick={() => placing?.onCancel()}
        >Annuler</button
      >
    </div>
  {/if}
  {#if onSearch && !exploring && !placing}
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

  /* Choix d'une position : curseur en croix partout sur la carte (tracés compris) ; les marqueurs
     laissent passer le clic, qui place le lieu là où il tombe. */
  .placing :global(.maplibregl-canvas) {
    cursor: crosshair !important;
  }

  .placing :global(.map-marker) {
    pointer-events: none;
  }

  .placing-banner {
    position: absolute;
    top: 14px;
    left: 50%;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 6px 6px 6px 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-float);
    color: var(--fg);
    font: 600 13px var(--font-display);
    translate: -50% 0;
    white-space: nowrap;
  }

  .placing-banner .btn {
    min-height: 30px;
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

  /* Popups de la carte, comme la référence : coins de 14 px, ombre douce, croix discrète. */
  :global(.map-popup .maplibregl-popup-content) {
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--surface);
    box-shadow: var(--shadow-window);
    font-family: var(--font-body);
  }

  :global(.map-popup .maplibregl-popup-close-button) {
    top: 4px;
    right: 6px;
    color: var(--muted);
    font-size: 18px;
  }

  :global(.map-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
    border-top-color: var(--surface);
  }

  :global(.map-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
    border-bottom-color: var(--surface);
  }
</style>
