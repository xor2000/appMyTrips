<script lang="ts">
  import {
    POI_MIN_ZOOM,
    bboxCenter,
    dayTimeline,
    type Leg,
    type LegMode,
    type LegPatch,
    type Place,
    type Poi,
    type PoiCategory,
    type Role,
    type Step,
    type StepPatch,
    type StepType,
    type StayItem,
    type TripSnapshot,
  } from '@mytrips/core';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import {
    ApiError,
    createLeg,
    createStay,
    createStep,
    deleteLeg,
    deleteMember,
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
    updateStep,
    updateTrip,
    type MapView,
    type StepInput,
  } from '#lib/api.ts';
  import { dayTitle, formatPeriod, plural } from '#lib/format.ts';
  import { mapPoints, type MapPoint } from '#lib/map/points.ts';
  import { poiStepInput, sameView } from '#lib/poi/explore.ts';
  import { dayLegLines, dayPairs, isManual, suggestionFor, type DayPair } from '#lib/legs/legs.ts';
  import { endDrag, type DropTarget } from '#lib/steps/dnd.svelte.ts';
  import { positionAt, positionShift } from '#lib/steps/moves.ts';
  import { createSerialQueue } from '#lib/serial.ts';
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
  import Timeline from '#lib/components/steps/Timeline.svelte';

  let snapshot = $state<TripSnapshot | null>(null);
  let status = $state<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  let loadError = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let selectedDay = $state<string | null>(null);
  let editing = $state(false);
  let sharing = $state(false);
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
  const writes = createSerialQueue();

  const id = $derived(page.params.id ?? '');
  const trip = $derived(snapshot?.trip);
  const canEdit = $derived(snapshot?.role === 'owner' || snapshot?.role === 'editor');
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
  const labels = $derived(new Map(points.map((p) => [p.key, p.label])));
  const editingStep = $derived(steps.find((s) => s.id === editingStepId) ?? null);
  const editingStay = $derived(stays.find((s) => s.id === editingStayId) ?? null);
  const dayLabel = $derived(day ? `J${days.indexOf(day) + 1}` : null);
  const legs = $derived(snapshot?.legs ?? []);
  const pairs = $derived(dayPairs(items, legs));
  const legLines = $derived(exploring ? [] : dayLegLines(items, legs));
  const editingLeg = $derived(legs.find((l) => l.id === editingLegId) ?? null);
  const addedRefs = $derived(
    new Set(steps.map((s) => s.osmRef).filter((r): r is string => r !== null)),
  );
  const zoomTooLow = $derived(mapView !== null && mapView.zoom < POI_MIN_ZOOM);
  const poiStale = $derived(
    mapView !== null && searchedView !== null && !sameView(mapView, searchedView),
  );

  async function load() {
    try {
      snapshot = await getTrip(id);
      status = 'ready';
      if (selectedDay && !snapshot.days.some((d) => d.id === selectedDay)) selectedDay = null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) status = 'not_found';
      else {
        status = 'error';
        loadError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  $effect(() => {
    if (id) load();
  });

  /** Applique une modification ; sur conflit de version, recharge le voyage et prévient. */
  function apply(action: () => Promise<TripSnapshot | void>) {
    // Écritures en file : chacune part avec la version du voyage laissée par la précédente.
    return writes(async () => {
      try {
        const before = snapshot?.legs ?? [];
        const next = await action();
        snapshot = next ?? (await getTrip(id));
        notice = null;
        const after = new Set(snapshot.legs.map((l) => l.id));
        const gone = before.filter((l) => !after.has(l.id) && isManual(l));
        if (gone.length > 0) removedLegs = [...gone, ...removedLegs].slice(0, 10);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'version_conflict') {
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

  async function addMember(email: string, role: Role) {
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

  async function saveStep(patch: StepPatch) {
    const stepId = editingStepId;
    if (!stepId) return;
    await apply(() => updateStep(id, stepId, version(), patch));
    editingStepId = null;
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
    if (position) applyQuietly(() => updateStep(id, step.id, version(), { position }));
  }

  function drop(stepId: string, target: DropTarget) {
    endDrag();
    const dayId = target.dayId !== undefined ? target.dayId : selectedDay;
    const position = positionAt(siblingsOf(dayId, target.parentId), target.index, stepId);
    applyQuietly(() =>
      updateStep(id, stepId, version(), { dayId, parentId: target.parentId, position }),
    );
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

  function pickPoi(poi: Poi) {
    selectedPoi = selectedPoi === poi.id ? null : poi.id;
    if (selectedPoi) {
      document
        .querySelector(`[data-poi-id="${CSS.escape(poi.id)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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

  function editStay(item: StayItem) {
    if (canEdit) editingStayId = item.stay.id;
  }
</script>

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
      highlighted={highlighted === `${pair.fromKey}>${pair.toKey}`}
      suggestion={pair.leg ? null : suggestionFor(pair, removedLegs)}
      onCreate={(input) => addLeg(pair, input)}
      onEdit={(leg) => (editingLegId = leg.id)}
      onHover={(k) => (highlighted = k)}
    />
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
    <header class="trip-header">
      <div class="title-row">
        <a class="back" href={resolve('/')} aria-label="Retour aux voyages">←</a>
        <div class="title">
          <h1>{trip.name}</h1>
          <p>
            {formatPeriod(trip.startDate, trip.endDate)} · {plural(snapshot.days.length, 'jour')}
            {#if snapshot.role === 'viewer'}
              <span class="chip readonly">Lecture seule</span>
            {/if}
          </p>
        </div>
        <div class="tools">
          {#if canEdit}
            <button type="button" class="btn btn-soft" onclick={() => (editing = true)}>
              Modifier
            </button>
          {/if}
          {#if isOwner}
            <button type="button" class="btn btn-primary" onclick={() => (sharing = true)}>
              Partager
            </button>
          {/if}
        </div>
      </div>
      <DayTabs
        days={snapshot.days}
        selected={selectedDay}
        onSelect={(d) => (selectedDay = d)}
        onDropStep={canEdit ? dropOnDay : undefined}
      />
      {#if notice}
        <p class="notice" role="status">{notice}</p>
      {/if}
    </header>

    <div class="body">
      <SplitPane>
        {#snippet left()}
          <section class="panel">
            {#if exploring}
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
                onSelect={pickPoi}
                onHover={(poiId) => (hoveredPoi = poiId)}
                onBack={toggleExplore}
                loadWiki={(ref) => poiWiki(ref)}
              />
            {:else}
              {#if day}
                <div class="day-head">
                  <h2>{dayTitle(day.date)}</h2>
                  <p class="hours">{day.dayStart ?? trip.dayStart} → {day.dayEnd ?? trip.dayEnd}</p>
                </div>
                {#if day.notes}
                  <p class="notes">{day.notes}</p>
                {/if}
                <div data-testid="day-timeline">
                  <Timeline
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
                    after={legAfter}
                  />
                </div>
                {#if canEdit}
                  <div class="add-bar">
                    <button
                      type="button"
                      class="btn btn-primary"
                      onclick={() => (adding = { kind: 'place', type: null })}
                      >Ajouter un lieu</button
                    >
                    <button
                      type="button"
                      class="btn btn-soft"
                      onclick={() => (adding = { kind: 'stay' })}
                    >
                      Ajouter un séjour
                    </button>
                    <button
                      type="button"
                      class="btn btn-soft"
                      onclick={() => (adding = { kind: 'group' })}
                    >
                      Nouveau dossier
                    </button>
                  </div>
                {/if}
              {:else}
                <h2>Tout le voyage</h2>
                <ol class="day-list">
                  {#each days as d, i (d.id)}
                    {@const count = steps.filter(
                      (s) => s.dayId === d.id && s.kind === 'step',
                    ).length}
                    <li>
                      <button type="button" onclick={() => (selectedDay = d.id)}>
                        <b>J{i + 1}</b>
                        <span class="grow">{dayTitle(d.date)}</span>
                        <span class="count">{plural(count, 'étape')}</span>
                      </button>
                    </li>
                  {/each}
                </ol>
              {/if}
              <IdeasPanel
                {ideas}
                {canEdit}
                {highlighted}
                onAdd={() => (adding = { kind: 'idea', type: null })}
                onEdit={(s) => (editingStepId = s.id)}
                onMove={move}
                onDelete={askDelete}
                onHover={(k) => (highlighted = k)}
                onDrop={drop}
              />
            {/if}
          </section>
        {/snippet}
        {#snippet right()}
          <TripMap
            {points}
            {highlighted}
            fitKey={selectedDay ?? 'all'}
            onHover={(k) => (highlighted = k)}
            onPick={pickPoint}
            onAddHere={canEdit ? addHere : undefined}
            onViewChange={(v) => (mapView = v)}
            pois={exploring ? pois : []}
            {selectedPoi}
            {hoveredPoi}
            onPickPoi={pickPoi}
            onHoverPoi={(poiId) => (hoveredPoi = poiId)}
            {exploring}
            onToggleExplore={toggleExplore}
            lines={legLines}
          />
        {/snippet}
      </SplitPane>
    </div>
  </div>

  {#if editing}
    <TripFormDialog
      initial={{ name: trip.name, startDate: trip.startDate, endDate: trip.endDate }}
      onSubmit={(values) => saveTrip(values)}
      onClose={() => (editing = false)}
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
      onAdd={addMember}
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

  .trip-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-6);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .back {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--fg);
    text-decoration: none;
    font-size: 18px;
  }

  .title {
    flex: 1;
    min-width: 0;
  }

  h1 {
    font-size: 24px;
    font-weight: 800;
  }

  .title p {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .readonly {
    background: var(--warn-soft);
    color: var(--warn);
  }

  .tools {
    display: flex;
    gap: var(--space-2);
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

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-6);
  }

  .panel h2 {
    font-size: 20px;
  }

  .day-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .hours {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--muted);
  }

  .notes {
    margin: 0;
    white-space: pre-wrap;
  }

  .add-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
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
    background: var(--surface);
    box-shadow: var(--shadow-card);
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
