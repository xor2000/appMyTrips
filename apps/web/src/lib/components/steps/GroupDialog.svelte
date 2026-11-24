<script module lang="ts">
  import type { StepType } from '@mytrips/core';

  /** Valeurs d'un dossier : nom, icône (null : dossier) et couleur (null : accent). */
  export interface GroupValues {
    name: string;
    icon: StepType | null;
    color: number | null;
  }
</script>

<script lang="ts">
  import {
    LEG_COLOR_COUNT,
    STEP_TYPE_INFO,
    STEP_TYPES,
    legColorVar,
    type Step,
  } from '@mytrips/core';
  import { untrack } from 'svelte';
  import Check from 'lucide-svelte/icons/check';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import { LEG_COLOR_NAMES } from '#lib/legs/legs.ts';
  import { GROUP_ICON, STEP_ICONS } from '#lib/steps/icons.ts';
  import Modal from '../Modal.svelte';

  interface Props {
    /** Dossier existant (modification), ou absent (création). */
    group?: Step;
    onSave: (values: GroupValues) => Promise<void>;
    onClose: () => void;
  }

  let { group, onSave, onClose }: Props = $props();

  // Valeurs de départ, lues une seule fois à l'ouverture.
  const start = untrack(() => group);
  let name = $state(start?.name ?? '');
  let icon = $state<StepType | null>(start?.icon ?? null);
  let color = $state<number | null>(start?.color ?? null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  const FolderIcon = GROUP_ICON;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = 'Donnez un nom au dossier.';
      return;
    }
    busy = true;
    error = null;
    try {
      await onSave({ name: name.trim(), icon, color });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  title={start ? 'Modifier le dossier' : 'Nouveau dossier'}
  subtitle="Un dossier regroupe des lieux : glissez-les dedans."
  {onClose}
>
  <form id="group-form" class="form" onsubmit={submit} novalidate>
    <label class="field ref">
      Nom du dossier
      <input
        type="text"
        bind:value={name}
        maxlength="200"
        placeholder="Vieux-Port, musées à voir…"
        data-autofocus
      />
    </label>
    <!-- Icône en grille de boutons, comme la catégorie d'un lieu (`.cat-grid`). -->
    <fieldset class="field ref">
      <legend>Icône</legend>
      <div class="cat-grid">
        <label style="--c: var(--accent)">
          <input
            class="visually-hidden"
            type="radio"
            name="group-icon"
            value={null}
            bind:group={icon}
          />
          <FolderIcon size={18} aria-hidden="true" />
          <span>Dossier</span>
        </label>
        {#each STEP_TYPES as t (t)}
          {@const Icon = STEP_ICONS[t]}
          <label style={`--c: var(${STEP_TYPE_INFO[t].color})`}>
            <input
              class="visually-hidden"
              type="radio"
              name="group-icon"
              value={t}
              bind:group={icon}
            />
            <Icon size={18} aria-hidden="true" />
            <span>{STEP_TYPE_INFO[t].label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    <!-- Couleur en pastilles rondes, comme celle d'un trajet (`.swatches`). -->
    <fieldset class="field ref">
      <legend>Couleur</legend>
      <div class="swatches">
        <label class="auto" style="--c: var(--accent)" title="Automatique : couleur d'accent">
          <input
            class="visually-hidden"
            type="radio"
            name="group-color"
            value={null}
            aria-label="Automatique"
            bind:group={color}
          />
          <Sparkles size={14} aria-hidden="true" />
        </label>
        {#each { length: LEG_COLOR_COUNT } as _, i (i)}
          <label style={`--c: var(${legColorVar(i)})`} title={LEG_COLOR_NAMES[i]}>
            <input
              class="visually-hidden"
              type="radio"
              name="group-color"
              value={i}
              aria-label={LEG_COLOR_NAMES[i]}
              bind:group={color}
            />
            {#if color === i}<Check size={14} aria-hidden="true" />{/if}
          </label>
        {/each}
      </div>
    </fieldset>
  </form>
  {#if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onClose}>Annuler</button>
    <button type="submit" form="group-form" class="btn btn-primary" disabled={busy}
      >{start ? 'Enregistrer' : 'Créer le dossier'}</button
    >
  {/snippet}
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* Pastille « automatique » : filet pointillé autour de la couleur d'accent. */
  .swatches .auto {
    outline: 1.5px dashed var(--muted);
    outline-offset: 2px;
  }
</style>
