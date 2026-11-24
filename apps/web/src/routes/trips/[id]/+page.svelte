<script lang="ts">
  import {
    POI_MIN_ZOOM,
    bboxCenter,
    dayTimeline,
    legPairKey,
    planOfflineTiles,
    proposeFixes,
    tripBboxes,
    resolveDayBounds,
    scheduleDay,
    type BatchOp,
    type Day,
    type Fix,
    type Leg,
    type LegMode,
    type LegPatch,
    type Place,
    type Poi,
    type PoiCategory,
    type Role,
    type ScheduledItem,
    type Step,
    type StepPatch,
    type StepType,
    type StayItem,
    type TripSnapshot,
  } from '@mytrips/core';
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import {
    ApiError,
    applyBatch,
    createLeg,
    deleteGpx,
    putGpx,
    createStay,
    createStep,
    deleteLeg,
    createInvitation,
    deleteMember,
    deleteTrip,
    deleteStay,
    deleteStep,
    explorePois,
    getTrip,
    poiWiki,
    putMember,
    reversePlace,
    searchPlaces,
    updateLeg,
    updateStay,
    searchCovers,
    updateTrip,
    type MapView,
    type StepInput,
  } from '#lib/api.ts';
  import { dayHoursLabel, dayTitle, formatPeriod, plural } from '#lib/format.ts';
  import { mapPoints, type MapPoint } from '#lib/map/points.ts';
  import {
    legPopupContent,
    poiPopupContent,
    stepPopupContent,
    type FocusTarget,
    type PopupTarget,
  } from '#lib/map/popups.ts';
  import { poiStepInput, sameView } from '#lib/poi/explore.ts';
  import {
    dayHikeLines,
    dayLegLines,
    isManual,
    suggestionFor,
    type DayPair,
  } from '#lib/legs/legs.ts';
  import { endDrag, type DropTarget } from '#lib/steps/dnd.svelte.ts';
  import { positionAt, positionShift } from '#lib/steps/moves.ts';
  import { createSerialQueue } from '#lib/serial.ts';
  import { pageHeader } from '#lib/page-header.svelte.ts';
  import { createHistory, inverseOps } from '#lib/schedule/history.ts';
  import { isGpxFile, readGpxFile } from '#lib/gpx/import.ts';
  import { PLAN_STYLE_URL } from '#lib/map/styles.ts';
  import { connection } from '#lib/offline/connection.svelte.ts';
  import { TILE_CACHE, offlineStore } from '#lib/offline/instance.ts';
  import { isNetworkError, loadWithFallback } from '#lib/offline/load.ts';
  import { forgetLastTrip, saveLastTrip, summaryFromSnapshot } from '#lib/home.ts';
  import { removeTrip, upsertTrip } from '#lib/trips/tripList.svelte.ts';
  import { buildDayViews } from '#lib/trips/dayViews.ts';
  import { glyphUrls, prefetchAll, resolveTileTemplate, tileUrl } from '#lib/offline/prefetch.ts';
  import type { PreparedTrip } from '#lib/offline/store.ts';
  import OfflineBanner from '#lib/components/offline/OfflineBanner.svelte';
  import OfflineDialog from '#lib/components/offline/OfflineDialog.svelte';
  import Redo2 from 'lucide-svelte/icons/redo-2';
  import Share2 from 'lucide-svelte/icons/share-2';
  import Undo2 from 'lucide-svelte/icons/undo-2';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import DayTabs from '#lib/components/DayTabs.svelte';
  import ShareDialog from '#lib/components/ShareDialog.svelte';
  import SplitPane from '#lib/components/SplitPane.svelte';
  import TripFormDialog, { type TripFormValues } from '#lib/components/TripFormDialog.svelte';
  import TripMap from '#lib/components/TripMap.svelte';
  import ExplorePanel from '#lib/components/poi/ExplorePanel.svelte';
  import LegEditor from '#lib/components/legs/LegEditor.svelte';
  import LegTile from '#lib/components/legs/LegTile.svelte';
  import AddPlaceDialog from '#lib/components/steps/AddPlaceDialog.svelte';
  import DeleteGroupDialog from '#lib/components/steps/DeleteGroupDialog.svelte';
  import GroupDialog from '#lib/components/steps/GroupDialog.svelte';
  import IdeasPanel from '#lib/components/steps/IdeasPanel.svelte';
  import StayDialog, { type StayValues } from '#lib/components/steps/StayDialog.svelte';
  import StepEditor from '#lib/components/steps/StepEditor.svelte';
  import MetroLeg from '#lib/components/legs/MetroLeg.svelte';
  import MetroLine from '#lib/components/steps/MetroLine.svelte';
  import Timeline from '#lib/components/steps/Timeline.svelte';
  import LayoutSwitch from '#lib/components/LayoutSwitch.svelte';
  import { readLayout, saveLayout, type LayoutId } from '#lib/layout.ts';
  import DaySummary from '#lib/components/schedule/DaySummary.svelte';
  import ReorganizePanel from '#lib/components/schedule/ReorganizePanel.svelte';

  let snapshot = $state<TripSnapshot | null>(null);
  let status = $state<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  let loadError = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let selectedDay = $state<string | null>(null);
  /** Affichage de la journée (liste, ligne de métro, plein écran), mémorisé par appareil. */
  let layout = $state<LayoutId>(readLayout());
  /** Plein écran : carte ou timeline des jours en colonnes. */
  let boardMode = $state<'map' | 'timeline'>('timeline');

  function changeLayout(id: LayoutId) {
    layout = id;
    saveLayout(id);
  }
  let editing = $state(false);
  let sharing = $state(false);
  /** Suppression du voyage en attente de confirmation (depuis ses paramètres). */
  let deletingTrip = $state(false);
  /** Modification de période en attente de confirmation (jours non vides à supprimer). */
  let pendingPeriod = $state<{ values: TripFormValues; dates: string[] } | null>(null);
  /** Fenêtre d'ajout ouverte : lieu du jour, idée, dossier ou séjour. */
  let adding = $state<
    { kind: 'place' | 'idea'; type: StepType | null } | { kind: 'group' | 'stay' } | null
  >(null);
  let editingStepId = $state<string | null>(null);
  let editingStayId = $state<string | null>(null);
  let deletingGroup = $state<Step | null>(null);
  /** Étape (ou dossier vide) en attente de confirmation de suppression. */
  let deletingStep = $state<Step | null>(null);
  let highlighted = $state<string | null>(null);
  /** Lieu choisi dans la colonne ou sur la carte (popup ouverte) : reste mis en évidence. */
  let selectedKey = $state<string | null>(null);
  /** Demande de centrage et de popup pour la carte (`seq` change à chaque clic). */
  let mapFocus = $state<{ target: FocusTarget; seq: number } | null>(null);
  let mapView = $state<MapView | null>(null);
  const mapCenter = $derived(mapView ? bboxCenter(mapView.bbox) : null);
  /** Découverte de lieux : panneau gauche et marqueurs dédiés. */
  let exploring = $state(false);
  let poiCategories = $state<PoiCategory[]>([]);
  let pois = $state<Poi[]>([]);
  let poiStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let poiError = $state<string | null>(null);
  /** Vue de la carte lors de la dernière recherche (pour proposer de relancer). */
  let searchedView = $state<MapView | null>(null);
  let selectedPoi = $state<string | null>(null);
  let hoveredPoi = $state<string | null>(null);
  let poiRequest = 0;
  let editingLegId = $state<string | null>(null);
  /** Saisie manuelle d'un trajet sans itinéraire trouvé. */
  let manualLeg = $state<{ pair: DayPair; mode: LegMode } | null>(null);
  /** Trajets saisis à la main retirés par un réordonnancement : proposés à la reprise. */
  let removedLegs = $state<Leg[]>([]);
  let reorganizing = $state(false);
  /** Annuler / rétablir : modifications et déplacements (pas les créations ni suppressions). */
  const history = createHistory();
  let canUndo = $state(false);
  let canRedo = $state(false);
  const syncHistory = () => {
    canUndo = history.canUndo;
    canRedo = history.canRedo;
  };
  const writes = createSerialQueue();

  const id = $derived(page.params.id ?? '');
  const trip = $derived(snapshot?.trip);
  /** Hors ligne : consultation seule, comme pour un lecteur (viewer). */
  const online = $derived(connection.online);
  const canEdit = $derived(online && (snapshot?.role === 'owner' || snapshot?.role === 'editor'));
  /** Date de la copie affichée hors ligne (null : données fraîches). */
  let savedAt = $state<string | null>(null);
  /** Préparation hors ligne : fenêtre, voyage préparé, progression. */
  let offlineOpen = $state(false);
  let prepared = $state<PreparedTrip | null>(null);
  let usedBytes = $state<number | null>(null);
  let offlineProgress = $state<{ done: number; total: number } | null>(null);
  let offlineError = $state<string | null>(null);
  const offlinePlan = $derived(
    offlineOpen && snapshot ? planOfflineTiles(tripBboxes(snapshot)) : null,
  );
  const isOwner = $derived(snapshot?.role === 'owner');
  const days = $derived(snapshot?.days ?? []);
  const steps = $derived(snapshot?.steps ?? []);
  const stays = $derived(snapshot?.stays ?? []);
  const day = $derived(days.find((d) => d.id === selectedDay) ?? null);
  const items = $derived(
    day
      ? dayTimeline(
          day.date,
          steps.filter((s) => s.dayId === day.id),
          stays,
        )
      : [],
  );
  const ideas = $derived(steps.filter((s) => s.dayId === null && s.parentId === null));
  const points = $derived(mapPoints({ days, steps, stays }, selectedDay));
  const editingStep = $derived(steps.find((s) => s.id === editingStepId) ?? null);
  const editingStay = $derived(stays.find((s) => s.id === editingStayId) ?? null);
  const dayLabel = $derived(day ? `J${days.indexOf(day) + 1}` : null);
  const legs = $derived(snapshot?.legs ?? []);
  const legLines = $derived(exploring ? [] : [...dayHikeLines(items), ...dayLegLines(items, legs)]);
  const editingLeg = $derived(legs.find((l) => l.id === editingLegId) ?? null);

  /** Données d'un jour pour le moteur d'horaires. */
  function dayInput(d: Day) {
    if (!trip) throw new Error('Voyage non chargé');
    return {
      date: d.date,
      steps: steps.filter((s) => s.dayId === d.id),
      stays,
      legs,
      ...resolveDayBounds(d, trip),
      timezone: trip.defaultTimezone,
    };
  }
  const schedules = $derived(
    new Map(trip ? days.map((d) => [d.id, scheduleDay(dayInput(d))]) : []),
  );
  /** Modèle de chaque jour, partagé par les trois affichages (voir lib/trips/dayViews.ts). */
  const dayViews = $derived(buildDayViews({ days, steps, stays, legs }, schedules));
  const dayView = $derived(dayViews.find((v) => v.day.id === selectedDay) ?? null);
  const labels = $derived(dayView?.labels ?? new Map<string, string>());
  const times = $derived(dayView?.times ?? new Map<string, ScheduledItem>());
  /** Paires de trajets de tous les jours : la tuile d'un trajet se trouve par son départ. */
  const pairs = $derived(new Map(dayViews.flatMap((v) => [...v.pairs])));
  const alerts = $derived(
    new Set(
      [...schedules]
        .filter(([, sc]) => sc.summary.conflictCount > 0 || sc.summary.overrunMin > 0)
        .map(([dayId]) => dayId),
    ),
  );
  /** Propositions de réorganisation du jour affiché (calculées à l'ouverture du panneau). */
  const fixes = $derived.by((): Fix[] => {
    if (!reorganizing || !day || !trip) return [];
    const index = days.indexOf(day);
    const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const otherDays = days
      .filter((d) => d.id !== day.id)
      .map((d) => {
        const bounds = resolveDayBounds(d, trip);
        const summary = schedules.get(d.id)?.summary;
        const used = (summary?.onSiteMin ?? 0) + (summary?.travelMin ?? 0);
        return {
          dayId: d.id,
          label: `J${days.indexOf(d) + 1}`,
          freeMin: minutes(bounds.dayEnd) - minutes(bounds.dayStart) - used,
        };
      });
    const next = days[index + 1];
    return proposeFixes({
      ...dayInput(day),
      dayId: day.id,
      otherDays,
      nextDay: next ? { dayId: next.id, label: `J${index + 2}` } : null,
    });
  });
  const addedRefs = $derived(
    new Set(steps.map((s) => s.osmRef).filter((r): r is string => r !== null)),
  );
  const zoomTooLow = $derived(mapView !== null && mapView.zoom < POI_MIN_ZOOM);
  const poiStale = $derived(
    mapView !== null && searchedView !== null && !sameView(mapView, searchedView),
  );

  async function load() {
    try {
      const tripId = id;
      const result = await loadWithFallback({
        online: connection.online,
        fetch: () => getTrip(tripId),
        readCopy: () => offlineStore.loadTrip<TripSnapshot>(tripId),
        writeCopy: async (data) => {
          await offlineStore.saveTrip(tripId, data);
          // La liste hors ligne doit contenir ce voyage, même ouvert après elle.
          await offlineStore.upsertTripInList(summaryFromSnapshot(data));
        },
        onNetworkError: () => connection.markOffline(),
      });
      snapshot = result.data;
      savedAt = result.savedAt;
      status = 'ready';
      if (selectedDay && !snapshot.days.some((d) => d.id === selectedDay)) selectedDay = null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        status = 'not_found';
        // Supprimé ou plus partagé : ni dans la liste de l'en-tête, ni rouvert par « / ».
        removeTrip(id);
        forgetLastTrip(id);
      } else {
        status = 'error';
        loadError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  $effect(() => {
    if (!id) return;
    // La page est réutilisée d'un voyage à l'autre : l'historique ne vaut que pour ce voyage.
    // « / » rouvrira ce voyage (il n'y a plus de page d'accueil) ; dès l'ouverture, pour ne pas
    // dépendre de la fin du chargement. Un voyage introuvable est oublié (voir load).
    saveLastTrip(id);
    untrack(() => {
      history.clear();
      syncHistory();
      reorganizing = false;
    });
    load();
  });

  // Au retour du réseau : données fraîches, édition à nouveau possible.
  $effect(() => connection.onReconnect(() => load()));

  /** Applique une modification ; sur conflit de version, recharge le voyage et prévient. */
  function apply(action: () => Promise<TripSnapshot | void>) {
    // Écritures en file : chacune part avec la version du voyage laissée par la précédente.
    return writes(async () => {
      try {
        const before = snapshot?.legs ?? [];
        const next = await action();
        snapshot = next ?? (await getTrip(id));
        notice = null;
        // Copie hors ligne : objet brut ($state.snapshot), un proxy Svelte n'est pas clonable.
        offlineStore.saveTrip(id, $state.snapshot(snapshot)).catch(() => undefined);
        const after = new Set(snapshot.legs.map((l) => l.id));
        const gone = before.filter((l) => !after.has(l.id) && isManual(l));
        if (gone.length > 0) removedLegs = [...gone, ...removedLegs].slice(0, 10);
      } catch (e) {
        if (isNetworkError(e)) {
          connection.markOffline();
          throw new Error('Hors ligne : la modification n’a pas été enregistrée.', { cause: e });
        }
        if (e instanceof ApiError && e.code === 'version_conflict') {
          // Les inverses enregistrés ne correspondent plus à l'état du voyage.
          history.clear();
          syncHistory();
          await load();
          notice = e.message;
          return;
        }
        throw e;
      }
    });
  }

  /** Comme apply, mais affiche l'erreur dans le bandeau (actions sans fenêtre : glisser, monter…). */
  async function applyQuietly(action: () => Promise<TripSnapshot | void>) {
    try {
      await apply(action);
    } catch (e) {
      notice = e instanceof Error ? e.message : String(e);
    }
  }

  const version = () => snapshot?.trip.version ?? 0;

  async function saveTrip(values: TripFormValues, force = false) {
    if (!trip) return;
    try {
      await apply(() => updateTrip(id, trip.version, values, { force }));
      editing = false;
      pendingPeriod = null;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'days_not_empty') {
        editing = false;
        pendingPeriod = { values, dates: (e.body.dates as string[]) ?? [] };
        return;
      }
      throw e;
    }
  }

  async function confirmDeleteTrip() {
    await deleteTrip(id);
    removeTrip(id);
    forgetLastTrip(id);
    deletingTrip = false;
    // « / » ouvre un autre voyage, ou propose d'en créer un.
    await goto(resolve('/'), { replaceState: true });
  }

  /** Crée un lien d'invitation et renvoie son URL complète. */
  async function inviteMember(role: Role) {
    const { token } = await createInvitation(id, role);
    return `${location.origin}/invitation/${token}`;
  }

  async function changeMemberRole(email: string, role: Role) {
    await apply(() => putMember(id, email, role));
  }

  async function removeMember(email: string) {
    await apply(() => deleteMember(id, email));
  }

  /** Recherche biaisée vers le centre de la carte. */
  const search = (q: string) => searchPlaces(q, mapCenter);

  async function addPlace(place: Place, type: StepType, dayId: string | null) {
    const input: StepInput = {
      dayId,
      type,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      osmRef: place.osmRef,
    };
    await apply(() => createStep(id, version(), input));
    adding = null;
  }

  /** Randonnée créée depuis un fichier GPX (analysé dans le navigateur), dans le jour affiché. */
  async function addHikeFromFile(file: File) {
    try {
      const { name, gpx } = await readGpxFile(file);
      await apply(() =>
        createStep(id, version(), {
          dayId: selectedDay,
          type: 'hike',
          name: name.slice(0, 200),
          gpx,
        }),
      );
    } catch (e) {
      notice = e instanceof Error ? e.message : String(e);
    }
  }

  function pickHikeFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) addHikeFromFile(file);
  }

  /** Fichiers GPX glissés depuis l'ordinateur sur la timeline (pas les étapes déplacées). */
  function onFileDragOver(event: DragEvent) {
    if (canEdit && event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onFileDrop(event: DragEvent) {
    const files = [...(event.dataTransfer?.files ?? [])].filter(isGpxFile);
    if (!canEdit || files.length === 0) return;
    event.preventDefault();
    for (const file of files) addHikeFromFile(file);
  }

  async function importGpx(file: File) {
    const stepId = editingStepId;
    if (!stepId) return;
    const { gpx } = await readGpxFile(file);
    await apply(() => putGpx(id, stepId, version(), gpx));
  }

  async function removeGpx() {
    const stepId = editingStepId;
    if (!stepId) return;
    await apply(() => deleteGpx(id, stepId, version()));
  }

  async function addGroup(name: string) {
    await apply(() => createStep(id, version(), { dayId: selectedDay, kind: 'group', name }));
    adding = null;
  }

  async function saveStay(values: StayValues) {
    const stayId = editingStayId;
    if (stayId) await apply(() => updateStay(id, stayId, version(), values));
    else await apply(() => createStay(id, version(), values));
    adding = null;
    editingStayId = null;
  }

  async function removeStay() {
    const stayId = editingStayId;
    if (!stayId) return;
    await applyQuietly(() => deleteStay(id, stayId, version()));
    editingStayId = null;
  }

  /** Applique un lot annulable : ses inverses sont calculés sur l'état actuel. */
  async function runCommand(label: string, ops: BatchOp[]) {
    const undo = inverseOps({ steps, days }, ops);
    await apply(() => applyBatch(id, version(), ops));
    history.push({ label, redo: ops, undo });
    syncHistory();
  }

  async function undo() {
    const entry = history.takeUndo();
    syncHistory();
    if (!entry) return;
    try {
      await apply(() => applyBatch(id, version(), entry.undo));
      notice = `Annulé : ${entry.label}`;
    } catch (e) {
      history.restoreUndo(entry);
      notice = e instanceof Error ? e.message : String(e);
    }
    syncHistory();
  }

  async function redo() {
    const entry = history.takeRedo();
    syncHistory();
    if (!entry) return;
    try {
      await apply(() => applyBatch(id, version(), entry.redo));
      notice = `Rétabli : ${entry.label}`;
    } catch (e) {
      history.restoreRedo(entry);
      notice = e instanceof Error ? e.message : String(e);
    }
    syncHistory();
  }

  /** Ctrl+Z / Ctrl+Y (ou Ctrl+Maj+Z), hors des champs de saisie et des fenêtres. */
  function onKeydown(event: KeyboardEvent) {
    if (!canEdit || !(event.ctrlKey || event.metaKey)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      redo();
    }
  }

  async function applyFix(fix: Fix) {
    await runCommand(fix.label, fix.ops);
    reorganizing = false;
  }

  async function saveStep(patch: StepPatch) {
    const stepId = editingStepId;
    if (!stepId) return;
    const name = steps.find((s) => s.id === stepId)?.name ?? 'étape';
    await runCommand(`Modifier ${name}`, [{ kind: 'step', id: stepId, patch }]);
    editingStepId = null;
  }

  /**
   * Clic sur un lieu de la colonne, comme sur la maquette de référence : sélection, zoom sur le
   * lieu et popup (« Modifier » y ouvre l'éditeur). Sans lieu sur la carte, ou en plein écran
   * (carte masquée), l'éditeur s'ouvre directement.
   */
  function openStep(step: Step) {
    if (layout === 'board' || !points.some((p) => p.stepId === step.id)) {
      editingStepId = step.id;
      return;
    }
    selectedKey = step.id;
    focusMap({ kind: 'step', key: step.id });
  }

  function focusMap(target: FocusTarget) {
    mapFocus = { target, seq: (mapFocus?.seq ?? 0) + 1 };
  }

  /**
   * Clic sur un trajet de la colonne : la carte cadre son tracé et ouvre sa popup (« Modifier »
   * y ouvre l'éditeur). Sans tracé affiché, ou en plein écran, l'éditeur s'ouvre directement.
   */
  function openLeg(leg: Leg) {
    const key = legPairKey(leg.fromKey, leg.toKey);
    if (layout === 'board' || !legLines.some((l) => l.key === key)) {
      if (canEdit) editingLegId = leg.id;
      return;
    }
    selectedKey = key;
    focusMap({ kind: 'leg', key });
  }

  /** Clic sur un lieu de la découverte : sélection, zoom sur le lieu et popup. */
  function openPoi(poi: Poi) {
    selectedPoi = poi.id;
    focusMap({ kind: 'poi', id: poi.id });
  }

  /** Nom d'un point du jour (étape ou séjour), pour le titre de la popup d'un trajet. */
  const pointName = (key: string) => points.find((p) => p.key === key)?.name ?? '?';

  function popupFor(target: PopupTarget) {
    if (target.kind === 'step') {
      const step = target.point.stepId
        ? steps.find((x) => x.id === target.point.stepId)
        : undefined;
      return step
        ? stepPopupContent(step, days, canEdit, {
            edit: (stepId) => (editingStepId = stepId),
            remove: askDeleteById,
          })
        : null;
    }
    if (target.kind === 'leg') {
      const leg = legs.find((l) => legPairKey(l.fromKey, l.toKey) === target.key);
      return leg
        ? legPopupContent(
            leg,
            { from: pointName(leg.fromKey), to: pointName(leg.toKey) },
            dayLabel,
            canEdit,
            { edit: (legId) => (editingLegId = legId), remove: removeLegById },
          )
        : null;
    }
    const poi = target.poi;
    const step = poi.osmRef ? steps.find((x) => x.osmRef === poi.osmRef) : undefined;
    return poiPopupContent(poi, step !== undefined, dayLabel, canEdit, {
      addToDay: () => addPoi(poi, true),
      addToIdeas: () => addPoi(poi, false),
      remove: () => step && askDelete(step),
    });
  }

  function onPopupClose(kind: PopupTarget['kind']) {
    if (kind === 'poi') selectedPoi = null;
    else selectedKey = null;
  }

  function askDeleteById(stepId: string) {
    const step = steps.find((x) => x.id === stepId);
    if (step) askDelete(step);
  }

  function askDelete(step: Step) {
    editingStepId = null;
    const children = steps.filter((s) => s.parentId === step.id).length;
    // Pas encore d'annulation (lot 5) : toute suppression est confirmée.
    if (step.kind === 'group' && children > 0) deletingGroup = step;
    else deletingStep = step;
  }

  async function confirmDeleteStep() {
    const step = deletingStep;
    if (!step) return;
    await apply(() => deleteStep(id, step.id, version()));
    deletingStep = null;
  }

  async function deleteGroup(children: 'keep' | 'delete') {
    const group = deletingGroup;
    if (!group) return;
    await apply(() => deleteStep(id, group.id, version(), children));
    deletingGroup = null;
  }

  /** Frères d'une étape : même jour, même dossier. */
  function siblingsOf(dayId: string | null, parentId: string | null) {
    return steps.filter((s) => s.dayId === dayId && s.parentId === parentId);
  }

  function move(step: Step, delta: -1 | 1) {
    const position = positionShift(siblingsOf(step.dayId, step.parentId), step.id, delta);
    if (position) {
      runCommand(`Déplacer ${step.name}`, [
        { kind: 'step', id: step.id, patch: { position } },
      ]).catch((e) => (notice = e instanceof Error ? e.message : String(e)));
    }
  }

  function drop(stepId: string, target: DropTarget) {
    endDrag();
    const dayId = target.dayId !== undefined ? target.dayId : selectedDay;
    const position = positionAt(siblingsOf(dayId, target.parentId), target.index, stepId);
    const name = steps.find((s) => s.id === stepId)?.name ?? 'étape';
    runCommand(`Déplacer ${name}`, [
      { kind: 'step', id: stepId, patch: { dayId, parentId: target.parentId, position } },
    ]).catch((e) => (notice = e instanceof Error ? e.message : String(e)));
  }

  /** Dépôt sur l'onglet d'un jour : à la fin de ce jour. */
  function dropOnDay(stepId: string, dayId: string) {
    drop(stepId, { dayId, parentId: null, index: siblingsOf(dayId, null).length });
  }

  /** Clic droit sur la carte : lieu le plus proche, ajouté au jour affiché (ou aux idées). */
  async function addHere(point: { lat: number; lng: number }) {
    const place = await reversePlace(point).catch(() => null);
    const name = place?.name ?? 'Point sur la carte';
    await applyQuietly(() =>
      createStep(id, version(), {
        dayId: selectedDay,
        type: place?.type ?? 'other',
        name,
        lat: point.lat,
        lng: point.lng,
        address: place?.address ?? null,
        osmRef: place?.osmRef ?? null,
      }),
    );
  }

  function pickPoint(point: MapPoint) {
    highlighted = point.key;
    document
      .querySelector(`[data-step-id="${point.stepId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Lieux de la zone visible pour les catégories cochées (jamais automatique au déplacement). */
  async function searchPois() {
    const view = mapView;
    const categories = poiCategories;
    if (!view || view.zoom < POI_MIN_ZOOM || categories.length === 0) return;
    const request = ++poiRequest;
    poiStatus = 'loading';
    poiError = null;
    try {
      const found = await explorePois(view, categories);
      // Une réponse plus ancienne qu'une recherche relancée entre-temps est ignorée.
      if (request !== poiRequest) return;
      pois = found;
      searchedView = view;
      poiStatus = 'ready';
    } catch (e) {
      if (request !== poiRequest) return;
      poiStatus = 'error';
      poiError = e instanceof Error ? e.message : String(e);
    }
  }

  function toggleCategory(category: PoiCategory) {
    poiCategories = poiCategories.includes(category)
      ? poiCategories.filter((c) => c !== category)
      : [...poiCategories, category];
    if (poiCategories.length === 0) {
      poiRequest++;
      pois = [];
      poiStatus = 'idle';
      return;
    }
    // Catégorie retirée : filtrage local ; ajoutée : nouvelle recherche.
    pois = pois.filter((p) => poiCategories.includes(p.category));
    if (poiCategories.includes(category)) searchPois();
  }

  async function addPoi(poi: Poi, toDay: boolean) {
    await applyQuietly(() =>
      createStep(id, version(), poiStepInput(poi, toDay ? selectedDay : null)),
    );
  }

  /** Lieu de la découverte cliqué sur la carte (la carte ouvre sa popup) : sélection dans la liste. */
  function pickPoi(poi: Poi) {
    selectedPoi = poi.id;
    document
      .querySelector(`[data-poi-id="${CSS.escape(poi.id)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function toggleExplore() {
    exploring = !exploring;
    selectedPoi = null;
    hoveredPoi = null;
  }

  async function addLeg(
    pair: DayPair,
    input: { mode: LegMode; distanceM?: number; durationMin?: number },
  ) {
    try {
      await apply(() =>
        createLeg(id, version(), { fromKey: pair.fromKey, toKey: pair.toKey, ...input }),
      );
      removedLegs = removedLegs.filter(
        (l) => !(l.fromKey === pair.fromKey || l.toKey === pair.toKey),
      );
    } catch (e) {
      // Aucun itinéraire : saisie manuelle proposée.
      if (e instanceof ApiError && e.code === 'no_route') manualLeg = { pair, mode: input.mode };
      else notice = e instanceof Error ? e.message : String(e);
    }
  }

  async function saveLeg(patch: LegPatch) {
    const legId = editingLegId;
    if (!legId) return;
    await apply(() => updateLeg(id, legId, version(), patch));
    editingLegId = null;
  }

  async function recomputeLeg() {
    const legId = editingLegId;
    if (!legId) return;
    await apply(() =>
      updateLeg(id, legId, version(), { distanceM: null, durationMin: null, recompute: true }),
    );
    editingLegId = null;
  }

  async function removeLeg() {
    const legId = editingLegId;
    if (!legId) return;
    editingLegId = null;
    await removeLegById(legId);
  }

  async function removeLegById(legId: string) {
    await applyQuietly(() => deleteLeg(id, legId, version()));
    removedLegs = removedLegs.filter((l) => l.id !== legId);
  }

  async function saveManualLeg(patch: LegPatch) {
    const pending = manualLeg;
    if (!pending || patch.durationMin == null) return;
    await apply(() =>
      createLeg(id, version(), {
        fromKey: pending.pair.fromKey,
        toKey: pending.pair.toKey,
        mode: patch.mode ?? pending.mode,
        durationMin: patch.durationMin ?? undefined,
        distanceM: patch.distanceM ?? undefined,
      }),
    );
    manualLeg = null;
  }

  async function openOffline() {
    offlineOpen = true;
    offlineError = null;
    prepared = await offlineStore.getPrepared(id).catch(() => null);
    const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
    usedBytes = estimate?.usage ?? null;
  }

  /**
   * Précharge la carte de la zone du voyage (le service worker met les tuiles en cache) et garde
   * l'instantané. Ne se lance que sur action de l'utilisateur, avec 4 requêtes au plus en parallèle.
   */
  async function prepareOffline() {
    const plan = offlinePlan;
    if (!plan || !snapshot) return;
    offlineError = null;
    offlineProgress = { done: 0, total: plan.tiles.length };
    try {
      await navigator.storage?.persist?.().catch(() => false);
      const { template, style } = await resolveTileTemplate(PLAN_STYLE_URL);
      const tileUrls = template ? plan.tiles.map((t) => tileUrl(template, t)) : [];
      const extras = glyphUrls(style);
      const sprite = (style as { sprite?: string }).sprite;
      if (typeof sprite === 'string') {
        extras.push(...['.json', '.png', '@2x.json', '@2x.png'].map((ext) => `${sprite}${ext}`));
      }
      const urls = [...tileUrls, ...extras];
      offlineProgress = { done: 0, total: urls.length };
      await prefetchAll(urls, {
        onProgress: (done, total) => (offlineProgress = { done, total }),
      });
      await offlineStore.saveTrip(id, $state.snapshot(snapshot));
      await offlineStore.markPrepared(id, {
        tileUrls,
        bytes: plan.tiles.length * 25_000,
      });
      prepared = await offlineStore.getPrepared(id);
      const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
      usedBytes = estimate?.usage ?? usedBytes;
    } catch (e) {
      offlineError = e instanceof Error ? e.message : String(e);
    } finally {
      offlineProgress = null;
    }
  }

  /** Oublie la préparation hors ligne : tuiles propres à ce voyage retirées du cache. */
  async function releaseOffline() {
    const urls = await offlineStore.removePrepared(id);
    const cache = await caches?.open(TILE_CACHE).catch(() => undefined);
    if (cache) await Promise.all(urls.map((url) => cache.delete(url)));
    prepared = null;
    const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
    usedBytes = estimate?.usage ?? null;
  }

  function editStay(item: StayItem) {
    if (canEdit) editingStayId = item.stay.id;
  }

  // Jours et actions sur la ligne de l'en-tête de l'application, le temps de la page ; la roue
  // crantée de l'en-tête ouvre les paramètres du voyage pour qui peut le modifier.
  $effect(() => {
    pageHeader.content = headerContent;
    pageHeader.settings = canEdit ? () => (editing = true) : null;
    return () => {
      pageHeader.content = null;
      pageHeader.settings = null;
    };
  });

  // Liste déroulante de l'en-tête à jour (nom, dates) : depuis chaque nouvel état du voyage.
  $effect(() => {
    if (!snapshot) return;
    const summary = summaryFromSnapshot(snapshot);
    untrack(() => upsertTrip(summary));
  });
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>{trip ? `${trip.name} · MyTrips` : 'Voyage · MyTrips'}</title>
</svelte:head>

{#snippet legAfter(key: string)}
  {@const pair = pairs.get(key)}
  {#if pair}
    <LegTile
      {pair}
      leg={pair.leg}
      {canEdit}
      highlighted={(highlighted ?? selectedKey) === `${pair.fromKey}>${pair.toKey}`}
      suggestion={pair.leg ? null : suggestionFor(pair, removedLegs)}
      onCreate={(input) => addLeg(pair, input)}
      onEdit={openLeg}
      onHover={(k) => (highlighted = k)}
    />
  {/if}
{/snippet}

<!-- Ligne de métro : trajet compact sur la ligne (mêmes actions que la tuile de la liste). -->
{#snippet metroLegAfter(key: string)}
  {@const pair = pairs.get(key)}
  {#if pair}
    <MetroLeg
      {pair}
      leg={pair.leg}
      {canEdit}
      highlighted={highlighted === `${pair.fromKey}>${pair.toKey}`}
      suggestion={pair.leg ? null : suggestionFor(pair, removedLegs)}
      onCreate={(input) => addLeg(pair, input)}
      onEdit={(leg) => (editingLegId = leg.id)}
      onHover={(k) => (highlighted = k)}
    />
  {/if}
{/snippet}

<!-- Jours et actions du voyage, sur la ligne de l'en-tête de l'application (layout), après le
     choix du voyage. -->
{#snippet headerContent()}
  {#if snapshot && trip}
    <div class="days">
      <DayTabs
        days={snapshot.days}
        selected={selectedDay}
        onSelect={(d) => (selectedDay = d)}
        onDropStep={canEdit ? dropOnDay : undefined}
        {alerts}
        period={formatPeriod(trip.startDate, trip.endDate)}
      />
    </div>
    {#if snapshot.role === 'viewer'}
      <span class="chip readonly">Lecture seule</span>
    {/if}
    <div class="tools">
      <LayoutSwitch value={layout} onChange={changeLayout} />
      {#if canEdit}
        <button
          type="button"
          class="icon-btn"
          aria-label="Annuler"
          title="Annuler (Ctrl+Z)"
          disabled={!canUndo}
          onclick={undo}><Undo2 size={18} /></button
        >
        <button
          type="button"
          class="icon-btn"
          aria-label="Rétablir"
          title="Rétablir (Ctrl+Y)"
          disabled={!canRedo}
          onclick={redo}><Redo2 size={18} /></button
        >
      {/if}
      {#if isOwner}
        <button
          type="button"
          class="icon-btn"
          aria-label="Partager"
          title="Partager"
          onclick={() => (sharing = true)}><Share2 size={18} /></button
        >
      {/if}
    </div>
  {/if}
{/snippet}

{#if status === 'loading'}
  <p class="state">Chargement du voyage…</p>
{:else if status === 'not_found'}
  <div class="state">
    <h1>Voyage introuvable</h1>
    <p>Ce voyage n’existe pas, ou il n’est pas partagé avec vous.</p>
    <a class="btn btn-soft" href={resolve('/')}>Retour aux voyages</a>
  </div>
{:else if status === 'error'}
  <div class="state">
    <p class="form-error" role="alert">{loadError}</p>
  </div>
{:else if snapshot && trip}
  <div class="trip">
    <!-- Le nom du voyage est affiché par la liste déroulante de l'en-tête. -->
    <h1 class="visually-hidden">{trip.name}</h1>
    {#if !online || notice}
      <div class="trip-banners">
        {#if !online}
          <OfflineBanner {savedAt} />
        {/if}
        {#if notice}
          <p class="notice" role="status">{notice}</p>
        {/if}
      </div>
    {/if}

    {#snippet explorePanel()}
      <div class="block">
        <ExplorePanel
          categories={poiCategories}
          {pois}
          status={poiStatus}
          error={poiError}
          {zoomTooLow}
          stale={poiStale}
          {dayLabel}
          {canEdit}
          {addedRefs}
          selectedId={selectedPoi}
          onToggleCategory={toggleCategory}
          onSearch={searchPois}
          onAdd={addPoi}
          onSelect={openPoi}
          onHover={(poiId) => (hoveredPoi = poiId)}
          onBack={toggleExplore}
          loadWiki={(ref) => poiWiki(ref)}
        />
      </div>
    {/snippet}

    {#snippet dayHead(d: Day)}
      {@const summary = schedules.get(d.id)?.summary}
      <div class="dayhead">
        <div class="day-head">
          <h2>{dayTitle(d.date)}</h2>
          <p class="hours">{dayHoursLabel(d.dayStart ?? trip.dayStart, d.dayEnd ?? trip.dayEnd)}</p>
        </div>
        {#if summary}
          <DaySummary
            {summary}
            {canEdit}
            onReorganize={() => {
              selectedDay = d.id;
              reorganizing = true;
            }}
          />
        {/if}
        {#if d.notes}
          <p class="notes">{d.notes}</p>
        {/if}
      </div>
    {/snippet}

    {#snippet addBar(dayId: string)}
      {#if canEdit}
        <!-- Les ajouts visent ce jour (utile en plein écran, où tous les jours sont visibles). -->
        <div class="add-bar">
          <button
            type="button"
            class="add-main"
            onclick={() => {
              selectedDay = dayId;
              adding = { kind: 'place', type: null };
            }}><span aria-hidden="true">+</span> Ajouter un lieu</button
          >
          <div class="add-more">
            <button
              type="button"
              class="btn btn-soft"
              onclick={() => {
                selectedDay = dayId;
                adding = { kind: 'stay' };
              }}
            >
              Ajouter un séjour
            </button>
            <button
              type="button"
              class="btn btn-soft"
              onclick={() => {
                selectedDay = dayId;
                adding = { kind: 'group' };
              }}
            >
              Nouveau dossier
            </button>
            <label class="btn btn-soft file">
              Importer une randonnée (GPX)
              <input
                type="file"
                accept=".gpx,application/gpx+xml"
                onchange={(e) => {
                  selectedDay = dayId;
                  pickHikeFile(e);
                }}
              />
            </label>
          </div>
        </div>
      {/if}
    {/snippet}

    {#snippet allDays()}
      <div class="block">
        <h2>Tout le voyage</h2>
        <ol class="day-list">
          {#each days as d, i (d.id)}
            {@const count = steps.filter((s) => s.dayId === d.id && s.kind === 'step').length}
            <li>
              <button type="button" onclick={() => (selectedDay = d.id)}>
                <b>J{i + 1}</b>
                <span class="grow">{dayTitle(d.date)}</span>
                <span class="count">{plural(count, 'étape')}</span>
              </button>
            </li>
          {/each}
        </ol>
      </div>
    {/snippet}

    {#snippet ideasBlock()}
      <div class="block">
        <IdeasPanel
          {ideas}
          {canEdit}
          highlighted={highlighted ?? selectedKey}
          onAdd={() => (adding = { kind: 'idea', type: null })}
          onEdit={openStep}
          onMove={move}
          onDelete={askDelete}
          onHover={(k) => (highlighted = k)}
          onDrop={drop}
        />
      </div>
    {/snippet}

    {#snippet tripMap()}
      <TripMap
        {points}
        highlighted={highlighted ?? selectedKey}
        fitKey={selectedDay ?? 'all'}
        onHover={(k) => (highlighted = k)}
        onPick={pickPoint}
        {popupFor}
        focus={mapFocus}
        {onPopupClose}
        onAddHere={canEdit ? addHere : undefined}
        onViewChange={(v) => (mapView = v)}
        pois={exploring ? pois : []}
        {selectedPoi}
        {hoveredPoi}
        onPickPoi={pickPoi}
        onHoverPoi={(poiId) => (hoveredPoi = poiId)}
        {exploring}
        onToggleExplore={online ? toggleExplore : undefined}
        onOffline={online ? openOffline : undefined}
        onSearch={canEdit
          ? () => (adding = { kind: selectedDay ? 'place' : 'idea', type: null })
          : undefined}
        lines={legLines}
      />
    {/snippet}

    <!-- Trois affichages de la journée (lib/layout.ts) : mêmes données, mêmes actions. -->
    <div class="body">
      {#if layout === 'list'}
        <SplitPane>
          {#snippet left()}
            <section class="panel">
              {#if exploring}
                {@render explorePanel()}
              {:else}
                {#if day}
                  {@render dayHead(day)}
                  <div class="block">
                    <div
                      data-testid="day-timeline"
                      role="presentation"
                      ondragover={onFileDragOver}
                      ondrop={onFileDrop}
                    >
                      <Timeline
                        {items}
                        {labels}
                        {canEdit}
                        highlighted={highlighted ?? selectedKey}
                        onEdit={openStep}
                        onEditStay={editStay}
                        onMove={move}
                        onDelete={askDelete}
                        onHover={(k) => (highlighted = k)}
                        onDrop={drop}
                        after={legAfter}
                        {times}
                      />
                    </div>
                    {@render addBar(day.id)}
                  </div>
                {:else}
                  {@render allDays()}
                {/if}
                {@render ideasBlock()}
              {/if}
            </section>
          {/snippet}
          {#snippet right()}
            {@render tripMap()}
          {/snippet}
        </SplitPane>
      {:else if layout === 'metro'}
        <div class="metro-layout">
          <div class="metro-map">{@render tripMap()}</div>
          <section class="metro-panel" aria-label="Journée">
            {#if exploring}
              <div class="metro-main">{@render explorePanel()}</div>
            {:else}
              <div class="metro-main">
                {#if day}
                  {@render dayHead(day)}
                  <div
                    class="metro-scroll"
                    data-testid="day-timeline"
                    role="presentation"
                    ondragover={onFileDragOver}
                    ondrop={onFileDrop}
                  >
                    <MetroLine
                      {items}
                      {labels}
                      {canEdit}
                      {highlighted}
                      onEdit={(s) => (editingStepId = s.id)}
                      onEditStay={editStay}
                      onMove={move}
                      onDelete={askDelete}
                      onHover={(k) => (highlighted = k)}
                      onDrop={drop}
                      after={metroLegAfter}
                      {times}
                    />
                  </div>
                  <div class="block">{@render addBar(day.id)}</div>
                {:else}
                  {@render allDays()}
                {/if}
              </div>
              <aside class="metro-ideas">{@render ideasBlock()}</aside>
            {/if}
          </section>
        </div>
      {:else}
        <div class="board-layout">
          <div class="board-bar">
            <div class="seg" role="group" aria-label="Plein écran">
              <button
                type="button"
                aria-pressed={boardMode === 'map'}
                onclick={() => (boardMode = 'map')}>Carte</button
              >
              <button
                type="button"
                aria-pressed={boardMode === 'timeline'}
                onclick={() => (boardMode = 'timeline')}>Timeline</button
              >
            </div>
          </div>
          {#if boardMode === 'map'}
            <div class="board-map">
              {@render tripMap()}
              {#if exploring}
                <aside class="board-explore">{@render explorePanel()}</aside>
              {/if}
            </div>
          {:else}
            <div class="board-columns" data-testid="board">
              {#each dayViews as v (v.day.id)}
                <section class="board-col" aria-label={`J${v.index + 1}`}>
                  <p class="board-day">J{v.index + 1}</p>
                  {@render dayHead(v.day)}
                  <div class="block">
                    <div
                      data-testid="day-timeline"
                      role="presentation"
                      ondragover={onFileDragOver}
                      ondrop={(e) => {
                        selectedDay = v.day.id;
                        onFileDrop(e);
                      }}
                    >
                      <Timeline
                        items={v.items}
                        labels={v.labels}
                        {canEdit}
                        {highlighted}
                        onEdit={(s) => (editingStepId = s.id)}
                        onEditStay={editStay}
                        onMove={move}
                        onDelete={askDelete}
                        onHover={(k) => (highlighted = k)}
                        onDrop={(id, target) => drop(id, { ...target, dayId: v.day.id })}
                        after={legAfter}
                        times={v.times}
                      />
                    </div>
                    {@render addBar(v.day.id)}
                  </div>
                </section>
              {/each}
              <section class="board-col board-ideas" aria-label="Idées du voyage">
                {@render ideasBlock()}
              </section>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if editing}
    <TripFormDialog
      initial={{ name: trip.name, startDate: trip.startDate, endDate: trip.endDate }}
      cover={trip.cover}
      searchCovers={online ? (query) => searchCovers(query) : undefined}
      places={steps.filter((s) => s.kind === 'step' && s.dayId).map((s) => s.name)}
      onSubmit={(values) => saveTrip(values)}
      onClose={() => (editing = false)}
      onDelete={isOwner
        ? () => {
            editing = false;
            deletingTrip = true;
          }
        : undefined}
    />
  {/if}

  {#if deletingTrip}
    <ConfirmDialog
      title="Supprimer le voyage ?"
      message={`« ${trip.name} » et tous ses jours seront supprimés. Cette action est définitive.`}
      confirmLabel="Supprimer définitivement"
      onConfirm={confirmDeleteTrip}
      onCancel={() => (deletingTrip = false)}
    />
  {/if}

  {#if pendingPeriod}
    {@const pending = pendingPeriod}
    <ConfirmDialog
      title="Supprimer des jours ?"
      message={`La nouvelle période retire ${plural(pending.dates.length, 'jour')} non vide${pending.dates.length > 1 ? 's' : ''} (${pending.dates.map(dayTitle).join(', ')}). Leurs étapes passeront dans les idées ; leurs notes seront perdues.`}
      confirmLabel="Supprimer ces jours"
      onConfirm={() => saveTrip(pending.values, true)}
      onCancel={() => (pendingPeriod = null)}
    />
  {/if}

  {#if sharing}
    <ShareDialog
      members={snapshot.members}
      onInvite={inviteMember}
      onRoleChange={changeMemberRole}
      onRemove={removeMember}
      onClose={() => (sharing = false)}
    />
  {/if}

  {#if adding?.kind === 'place' || adding?.kind === 'idea'}
    {@const forIdea = adding.kind === 'idea'}
    <AddPlaceDialog
      title={forIdea ? 'Ajouter une idée' : 'Ajouter un lieu'}
      {search}
      initialType={adding.type}
      onPick={(place, type) => addPlace(place, type, forIdea ? null : selectedDay)}
      onClose={() => (adding = null)}
    />
  {/if}

  {#if adding?.kind === 'group'}
    <GroupDialog onCreate={addGroup} onClose={() => (adding = null)} />
  {/if}

  {#if adding?.kind === 'stay' || editingStay}
    <StayDialog
      stay={editingStay ?? undefined}
      defaultDate={day?.date ?? trip.startDate}
      {search}
      onSave={saveStay}
      onDelete={editingStay ? removeStay : undefined}
      onClose={() => {
        adding = null;
        editingStayId = null;
      }}
    />
  {/if}

  {#if editingStep}
    <StepEditor
      step={editingStep}
      days={snapshot.days}
      onSave={saveStep}
      onDelete={() => askDelete(editingStep)}
      onImportGpx={importGpx}
      onRemoveGpx={removeGpx}
      onClose={() => (editingStepId = null)}
    />
  {/if}

  {#if editingLeg}
    <LegEditor
      leg={editingLeg}
      onSave={saveLeg}
      onRecompute={recomputeLeg}
      onDelete={removeLeg}
      onClose={() => (editingLegId = null)}
    />
  {/if}

  {#if manualLeg}
    {@const pending = manualLeg}
    <LegEditor
      isNew
      message="Aucun itinéraire trouvé : indiquez la durée (et la distance si vous la connaissez)."
      leg={{
        id: '',
        fromKey: pending.pair.fromKey,
        toKey: pending.pair.toKey,
        mode: pending.mode,
        distanceM: null,
        durationMin: 60,
        distanceSource: 'manual',
        durationSource: 'manual',
        geometry: null,
        summary: null,
        departAt: null,
        bookingRef: null,
        notes: '',
        computedAt: null,
      }}
      onSave={saveManualLeg}
      onRecompute={async () => {}}
      onDelete={() => {}}
      onClose={() => (manualLeg = null)}
    />
  {/if}

  {#if offlineOpen && offlinePlan}
    <OfflineDialog
      tileCount={offlinePlan.tiles.length}
      reduced={offlinePlan.reduced}
      {prepared}
      {usedBytes}
      progress={offlineProgress}
      error={offlineError}
      onPrepare={prepareOffline}
      onRelease={releaseOffline}
      onClose={() => (offlineOpen = false)}
    />
  {/if}

  {#if reorganizing}
    <ReorganizePanel {fixes} onApply={applyFix} onClose={() => (reorganizing = false)} />
  {/if}

  {#if deletingStep}
    <ConfirmDialog
      title={deletingStep.kind === 'group' ? 'Supprimer le dossier ?' : 'Supprimer l’étape ?'}
      message={`« ${deletingStep.name} » sera supprimé${deletingStep.kind === 'group' ? '' : 'e'}, avec ses notes et sa réservation.`}
      confirmLabel="Supprimer"
      onConfirm={confirmDeleteStep}
      onCancel={() => (deletingStep = null)}
    />
  {/if}

  {#if deletingGroup}
    <DeleteGroupDialog
      name={deletingGroup.name}
      childCount={steps.filter((s) => s.parentId === deletingGroup?.id).length}
      onConfirm={deleteGroup}
      onCancel={() => (deletingGroup = null)}
    />
  {/if}
{/if}

<style>
  .state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    max-width: 640px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    color: var(--muted);
  }

  .state h1 {
    color: var(--fg);
  }

  .trip {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Bandeaux (hors ligne, conflit) sous l'en-tête de l'application. */
  .trip-banners {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  /* Jours sur la ligne de l'en-tête : ils prennent la place restante et défilent. */
  .days {
    display: flex;
    flex: 1;
    min-width: 0;
  }

  .readonly {
    flex: none;
    background: var(--warn-soft);
    color: var(--warn);
  }

  .file {
    position: relative;
    cursor: pointer;
  }

  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .tools {
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    /* Sur la ligne du profil quand les jours passent dessous (tablette). */
    margin-left: auto;
  }

  /* Tablette : les jours passent sur une seconde ligne de l'en-tête, sur toute la largeur. */
  @media (max-width: 1024px) {
    .days {
      order: 1;
      flex-basis: 100%;
    }
  }

  .notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 13px;
    font-weight: 600;
  }

  .body {
    flex: 1;
    min-height: 0;
  }

  /* Panneau gauche façon maquette : en-tête du jour séparé par un filet, puis la timeline. */
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: var(--surface);
  }

  .panel h2 {
    font-size: 16px;
    font-weight: 700;
  }

  .dayhead {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) 14px;
    border-bottom: 1px solid var(--line);
  }

  /* Timeline compacte : espacements resserrés entre les blocs de la colonne. */
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) 14px;
  }

  .day-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
  }

  .hours {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--muted);
  }

  .notes {
    margin: 0;
    font-size: 13px;
    white-space: pre-wrap;
  }

  .add-bar {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .add-main {
    min-height: 32px;
    border: 1.5px dashed var(--accent);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--accent-strong);
    font: 600 13px var(--font-display);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .add-main:hover {
    background: var(--accent-soft);
  }

  .add-more {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-1);
  }

  .add-more .btn {
    min-height: 26px;
    padding: 0 var(--space-3);
    font-size: 12px;
  }

  /* Ligne de métro : carte en haut, journée en ligne dessous, idées à droite. */
  .metro-layout {
    display: grid;
    grid-template-rows: minmax(240px, 1fr) auto;
    height: 100%;
  }

  .metro-map {
    position: relative;
    min-height: 0;
  }

  .metro-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    max-height: 52vh;
    border-top: 1px solid var(--line);
    background: var(--surface);
    overflow: hidden;
  }

  .metro-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: auto;
  }

  .metro-scroll {
    overflow-x: auto;
    padding-top: var(--space-2);
  }

  .metro-ideas {
    border-left: 1px solid var(--line);
    overflow: auto;
  }

  /* Plein écran : carte ou colonnes de jours sur toute la surface. */
  .board-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .board-bar {
    display: flex;
    justify-content: center;
    padding: var(--space-2);
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }

  .seg {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }

  .seg button {
    padding: var(--space-1) var(--space-4);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    font: 600 13px var(--font-display);
    cursor: pointer;
  }

  .seg button[aria-pressed='true'] {
    background: var(--surface);
    color: var(--fg);
    box-shadow: var(--shadow-card);
  }

  .board-map {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .board-explore {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 380px;
    overflow: auto;
    background: var(--surface);
    box-shadow: var(--shadow-float);
  }

  .board-columns {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(340px, 1fr);
    overflow-x: auto;
    background: var(--bg);
  }

  .board-col {
    min-width: 0;
    overflow-y: auto;
    border-right: 1px solid var(--line);
    background: var(--surface);
  }

  .board-day {
    margin: var(--space-3) 14px 0;
    font: 800 13px var(--font-display);
    color: var(--accent-strong);
  }

  .board-ideas {
    background: var(--bg);
  }

  .day-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .day-list button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }

  .day-list b {
    font-family: var(--font-display);
    color: var(--accent-strong);
  }

  .grow {
    flex: 1;
  }

  .count {
    font-size: 12px;
    color: var(--muted);
  }
</style>
