<script lang="ts">
  import { STEP_TYPES, STEP_TYPE_INFO, type Day, type Step, type StepPatch } from '@mytrips/core';
  import MapPin from 'lucide-svelte/icons/map-pin';
  import { untrack } from 'svelte';
  import { dayTitle, formatKm } from '#lib/format.ts';
  import { STEP_ICONS } from '#lib/steps/icons.ts';
  import ElevationProfile from '../gpx/ElevationProfile.svelte';
  import Modal from '../Modal.svelte';

  interface Props {
    step: Step;
    days: Day[];
    onSave: (patch: StepPatch) => Promise<void>;
    onDelete: () => void;
    onClose: () => void;
    /**
     * Choix d'une nouvelle position en cliquant sur la carte (fenêtre masquée le temps du choix) :
     * le point cliqué, ou null si le choix est annulé.
     */
    onPickOnMap?: () => Promise<{ lat: number; lng: number } | null>;
    /** Import d'un GPX sur une randonnée (enregistré aussitôt). */
    onImportGpx?: (file: File) => Promise<void>;
    onRemoveGpx?: () => Promise<void>;
  }

  let { step, days, onSave, onDelete, onClose, onPickOnMap, onImportGpx, onRemoveGpx }: Props =
    $props();

  // Valeurs de départ, lues une seule fois à l'ouverture.
  const start = untrack(() => step);

  let name = $state(start.name);
  let type = $state(start.type ?? 'other');
  let durationMin = $state(start.durationMin);
  let hasFixed = $state(start.fixedStart !== null);
  let fixedStart = $state(start.fixedStart ?? '09:00');
  let bookingRef = $state(start.bookingRef ?? '');
  let bookingUrl = $state(start.bookingUrl ?? '');
  let openingHours = $state(start.openingHours ?? '');
  let useElevation = $state(start.useElevation);
  // Position à 6 décimales (environ 10 cm), comme la maquette ; texte pour garder la saisie.
  const coord = (v: number | null) => (v === null ? '' : v.toFixed(6));
  const startLat = coord(start.lat);
  const startLng = coord(start.lng);
  let lat = $state<string | number>(startLat);
  let lng = $state<string | number>(startLng);
  /** Fenêtre masquée pendant le choix d'une position sur la carte. */
  let picking = $state(false);

  async function pickOnMap() {
    if (!onPickOnMap) return;
    picking = true;
    try {
      const point = await onPickOnMap();
      if (point) {
        lat = coord(point.lat);
        lng = coord(point.lng);
      }
    } finally {
      picking = false;
    }
  }
  /** Tracé à jour (un import pendant l'édition met l'étape à jour). */
  const gpx = $derived(step.gpx);
  const isHike = $derived(type === 'hike');
  const gpxSummary = $derived(
    gpx
      ? [
          formatKm(gpx.stats.distanceM),
          gpx.stats.ascentM !== null && `D+ ${gpx.stats.ascentM} m`,
          gpx.stats.descentM !== null && `D− ${gpx.stats.descentM} m`,
          gpx.stats.isLoop && 'boucle',
        ]
          .filter(Boolean)
          .join(' · ')
      : '',
  );

  async function runGpx(action: () => Promise<void>) {
    error = null;
    busy = true;
    try {
      await action();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file && onImportGpx) runGpx(() => onImportGpx(file));
  }
  let notes = $state(start.notes);
  /** '' = liste d'idées. */
  let dayId = $state(start.dayId ?? '');
  let error = $state<string | null>(null);
  let busy = $state(false);

  const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = 'Le nom est obligatoire.';
      return;
    }
    if (bookingUrl.trim() && !/^https?:\/\/[^\s/?#]+\S*$/i.test(bookingUrl.trim())) {
      error = 'Le lien de réservation doit commencer par http:// ou https://.';
      return;
    }
    const patch: StepPatch = {};
    // Les champs numériques renvoient un nombre, ou '' quand ils sont vides.
    if (String(lat) !== startLat || String(lng) !== startLng) {
      const la = Number(lat);
      const ln = Number(lng);
      if (String(lat).trim() === '' || !Number.isFinite(la) || la < -90 || la > 90) {
        error = 'La latitude doit être comprise entre -90 et 90.';
        return;
      }
      if (String(lng).trim() === '' || !Number.isFinite(ln) || ln < -180 || ln > 180) {
        error = 'La longitude doit être comprise entre -180 et 180.';
        return;
      }
      patch.lat = la;
      patch.lng = ln;
    }
    if (name.trim() !== start.name) patch.name = name.trim();
    if (notes !== start.notes) patch.notes = notes;
    const nextDay = dayId === '' ? null : dayId;
    if (nextDay !== start.dayId) patch.dayId = nextDay;
    if (type !== start.type) patch.type = type;
    if (durationMin !== start.durationMin) patch.durationMin = durationMin;
    const fixed = hasFixed ? fixedStart : null;
    if (fixed !== start.fixedStart) patch.fixedStart = fixed;
    if (orNull(bookingRef) !== start.bookingRef) patch.bookingRef = orNull(bookingRef);
    if (orNull(bookingUrl) !== start.bookingUrl) patch.bookingUrl = orNull(bookingUrl);
    if (orNull(openingHours) !== start.openingHours) patch.openingHours = orNull(openingHours);
    if (useElevation !== start.useElevation) patch.useElevation = useElevation;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    error = null;
    busy = true;
    try {
      await onSave(patch);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  title="Modifier l’étape"
  subtitle="Mettez à jour les informations de cette étape."
  hidden={picking}
  {onClose}
>
  <form id="step-form" class="form" onsubmit={submit} novalidate>
    <label class="field ref">
      Nom du lieu
      <input type="text" bind:value={name} maxlength="200" />
    </label>
    {#if start.address}
      <p class="address">{start.address}</p>
    {/if}
    <!-- Catégories en grille de boutons icône et libellé (`.cat-grid` de la maquette). -->
    <fieldset class="field ref">
      <legend>Catégorie</legend>
      <div class="cat-grid">
        {#each STEP_TYPES as t (t)}
          {@const Icon = STEP_ICONS[t]}
          <label style={`--c: var(${STEP_TYPE_INFO[t].color})`}>
            <input
              class="visually-hidden"
              type="radio"
              name="step-type"
              value={t}
              bind:group={type}
            />
            <Icon size={18} aria-hidden="true" />
            <span>{STEP_TYPE_INFO[t].label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    <div class="field-row">
      <label class="field ref">
        Latitude
        <input type="number" step="any" min="-90" max="90" bind:value={lat} />
      </label>
      <label class="field ref">
        Longitude
        <input type="number" step="any" min="-180" max="180" bind:value={lng} />
      </label>
    </div>
    {#if onPickOnMap}
      <button type="button" class="btn btn-ghost pick" onclick={pickOnMap}>
        <MapPin size={15} aria-hidden="true" />Choisir sur la carte
      </button>
    {/if}
    <div class="field-row">
      <label class="field ref">
        Durée sur place (min)
        <input type="number" min="0" max="1440" step="5" bind:value={durationMin} />
      </label>
      <div class="fixed">
        <label class="check">
          <input type="checkbox" bind:checked={hasFixed} />
          Heure fixe
        </label>
        <label class="field ref" class:disabled={!hasFixed}>
          <span class="visually-hidden">Heure</span>
          <input type="time" bind:value={fixedStart} disabled={!hasFixed} />
        </label>
      </div>
    </div>
    <div class="field-row">
      <label class="field ref">
        N° de réservation
        <input type="text" bind:value={bookingRef} maxlength="200" />
      </label>
      <label class="field ref">
        Lien de réservation
        <input type="url" bind:value={bookingUrl} placeholder="https://…" />
      </label>
    </div>
    <label class="field ref">
      Horaires d’ouverture
      <input
        type="text"
        bind:value={openingHours}
        maxlength="500"
        placeholder="Format OpenStreetMap, ex. Mo-Fr 09:00-18:00"
      />
    </label>
    {#if isHike}
      <fieldset class="hike">
        <legend>Randonnée</legend>
        {#if gpx}
          <p class="stats">{gpxSummary}</p>
          <ElevationProfile track={gpx.track} />
        {/if}
        <label class="check">
          <input
            type="checkbox"
            bind:checked={useElevation}
            disabled={!gpx || gpx.stats.ascentM === null}
          />
          Inclure le dénivelé (+1 h / 600 m)
        </label>
        <div class="gpx-actions">
          {#if onImportGpx}
            <label class="btn btn-soft file">
              Importer un GPX
              <input type="file" accept=".gpx,application/gpx+xml" onchange={importFile} />
            </label>
          {/if}
          {#if gpx && onRemoveGpx}
            <button
              type="button"
              class="btn btn-ghost"
              disabled={busy}
              onclick={() => runGpx(onRemoveGpx)}>Retirer le GPX</button
            >
          {/if}
        </div>
        <p class="hint">
          La durée se calcule depuis le tracé, à la vitesse du voyage ; une durée saisie reste
          manuelle jusqu’au prochain changement d’option.
        </p>
      </fieldset>
    {/if}
    <label class="field ref">
      Jour
      <select bind:value={dayId}>
        {#each days as d, i (d.id)}
          <option value={d.id}>J{i + 1} · {dayTitle(d.date)}</option>
        {/each}
        <option value="">Idées (pas encore placé)</option>
      </select>
    </label>
    <label class="field ref">
      Notes
      <textarea rows="3" bind:value={notes} maxlength="5000"></textarea>
    </label>
    {#if error}
      <p class="form-error" role="alert">{error}</p>
    {/if}
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-danger-ghost" onclick={onDelete}>Supprimer</button>
    <span class="spacer"></span>
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
    <button type="submit" form="step-form" class="btn btn-primary" disabled={busy}
      >Enregistrer</button
    >
  {/snippet}
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* « Heure fixe » à côté de la durée : case et heure sur la ligne du champ. */
  .fixed {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .fixed .field {
    flex: 1;
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 38px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .pick {
    align-self: flex-start;
    min-height: 32px;
    margin-top: -6px;
  }

  .disabled {
    opacity: 0.5;
  }

  .address {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .hike {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-md);
  }

  .hike legend {
    padding: 0 var(--space-1);
    font-weight: 700;
  }

  .stats,
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .stats {
    color: var(--fg);
    font-family: var(--font-mono);
  }

  .gpx-actions {
    display: flex;
    gap: var(--space-2);
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

  .spacer {
    flex: 1;
  }
</style>
