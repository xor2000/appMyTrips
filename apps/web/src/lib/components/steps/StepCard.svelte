<script lang="ts">
  import { STEP_TYPE_INFO, type ScheduledItem, type Step } from '@mytrips/core';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronUp from 'lucide-svelte/icons/chevron-up';
  import Hourglass from 'lucide-svelte/icons/hourglass';
  import Lock from 'lucide-svelte/icons/lock';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import { formatDuration, formatKm } from '#lib/format.ts';
  import { endDrag, startDrag } from '#lib/steps/dnd.svelte.ts';
  import { GROUP_ICON, STEP_ICONS } from '#lib/steps/icons.ts';

  interface Props {
    step: Step;
    /** Numéro affiché sur la carte, s'il y en a un. */
    label?: string | null;
    canEdit: boolean;
    highlighted: boolean;
    onEdit: (step: Step) => void;
    onMove: (step: Step, delta: -1 | 1) => void;
    onDelete: (step: Step) => void;
    onHover: (key: string | null) => void;
    /** Horaires calculés par le moteur (absents hors d'un jour). */
    time?: ScheduledItem | null;
  }

  let {
    step,
    label = null,
    canEdit,
    highlighted,
    onEdit,
    onMove,
    onDelete,
    onHover,
    time = null,
  }: Props = $props();

  const info = $derived(step.type ? STEP_TYPE_INFO[step.type] : null);
  const late = $derived(
    time?.issues.reduce((t, i) => t + (i.kind === 'conflict' ? i.lateMin : 0), 0) ?? 0,
  );
  /** Horaires affichés à droite : début mis en avant, fin dessous. */
  const clock = $derived.by(() => {
    if (!time || step.kind === 'group') return null;
    const offset = time.end.dayOffset > 0 ? ` (+${time.end.dayOffset} j)` : '';
    return { start: time.start.time, end: `${time.end.time}${offset}` };
  });
  const Icon = $derived(
    step.type ? STEP_ICONS[step.type] : step.kind === 'group' ? GROUP_ICON : null,
  );
</script>

{#if time && time.freeBeforeMin >= 5}
  <p class="free" data-testid="free-time">
    <Hourglass size={14} aria-hidden="true" />
    {formatDuration(time.freeBeforeMin)} de temps libre
  </p>
{/if}
<div
  class="card"
  class:highlighted
  class:conflict={late > 0}
  data-testid="step-card"
  data-step-id={step.id}
  role="listitem"
  draggable={canEdit ? 'true' : 'false'}
  style={`--c: var(${info?.color ?? '--type-transport'})`}
  ondragstart={(e) => startDrag(e, step.id, step.kind)}
  ondragend={endDrag}
  onmouseenter={() => onHover(step.id)}
  onmouseleave={() => onHover(null)}
>
  <div class="box">
    <button type="button" class="main" onclick={() => onEdit(step)}>
      <span class="icon">
        {#if Icon}<Icon size={18} />{/if}
        {#if label}<span class="label">{label}</span>{/if}
      </span>
      <!-- Ordre du DOM : nom, type, horaires, pastilles (le nom accessible garde la forme
           « nom type… »). La mise en page place les pastilles à côté du nom. -->
      <span class="text">
        <span class="name">{step.name}</span>
        <span class="meta">
          {#if step.kind === 'group'}
            Dossier
          {:else}
            {info?.label ?? 'Étape'} · {formatDuration(step.durationMin)} sur place
          {/if}
        </span>
        <span class="pills">
          {#if late > 0}
            <span class="chip late">Conflit +{formatDuration(late)}</span>
          {/if}
          {#if step.fixedStart}
            <span class="chip fixed" title="Heure fixe"><Lock size={10} />{step.fixedStart}</span>
          {/if}
          {#if step.gpx}
            <span class="chip gpx">GPX {formatKm(step.gpx.stats.distanceM)}</span>
            {#if step.gpx.stats.ascentM !== null}
              <span class="chip gpx">D+ {step.gpx.stats.ascentM} m</span>
            {/if}
          {/if}
          {#if step.bookingRef}
            <span class="chip booking">Résa {step.bookingRef}</span>
          {/if}
        </span>
      </span>
      {#if clock}
        <!-- Façon agenda : début en gros, fin dessous. Texte lu : « début → fin ». -->
        <span class="clock">
          <span class="visually-hidden">{clock.start} → {clock.end}</span>
          <span class="start" data-testid="step-start" aria-hidden="true">{clock.start}</span>
          <span class="end" aria-hidden="true">→ {clock.end}</span>
        </span>
      {/if}
    </button>
    {#if canEdit}
      <div class="actions">
        <button type="button" aria-label={`Monter ${step.name}`} onclick={() => onMove(step, -1)}>
          <ChevronUp size={16} />
        </button>
        <button type="button" aria-label={`Descendre ${step.name}`} onclick={() => onMove(step, 1)}>
          <ChevronDown size={16} />
        </button>
        <button type="button" aria-label={`Supprimer ${step.name}`} onclick={() => onDelete(step)}>
          <Trash2 size={15} />
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .card[draggable='true'] {
    cursor: grab;
  }

  .box {
    position: relative;
    display: flex;
    align-items: stretch;
    min-width: 0;
    border: var(--card-edge) solid var(--line);
    border-radius: var(--card-radius);
    background: color-mix(in srgb, var(--c) var(--card-tint), var(--surface));
    box-shadow: 0 2px 0 color-mix(in srgb, var(--c) var(--card-lift), transparent);
    transition: box-shadow 0.15s;
  }

  .card.conflict .box {
    box-shadow: 0 0 0 2px var(--bad);
  }

  /* Mise en évidence sans déplacement : un liseré seulement (rien ne bouge au survol). */
  .card.highlighted .box {
    box-shadow: 0 0 0 2px var(--c);
  }

  /* Temps libre : pastille verte centrée sur la ligne de la timeline (fond plein qui la masque). */
  .free {
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0;
    padding: var(--space-1) var(--space-3);
    border: 1.5px dashed var(--ok);
    border-radius: var(--radius-pill);
    background: var(--ok-soft);
    color: var(--ok);
    font: 700 13px var(--font-display);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 10px var(--space-3);
    border: 0;
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: inherit;
  }

  .icon {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: var(--icon-radius);
    background: color-mix(in srgb, var(--c) var(--icon-tint), transparent);
    color: color-mix(in srgb, var(--c) var(--icon-ink), var(--on-type));
  }

  .label {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--fg);
    font: 700 11px/18px var(--font-display);
    text-align: center;
    box-shadow: var(--shadow-card);
  }

  /*
   * Ligne 1 : nom et pastilles ; ligne 2 : horaires puis type et durée. L'ordre visuel diffère de
   * l'ordre du DOM (voir plus haut) grâce à `order` et à un saut de ligne en ::after.
   */
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
  }

  .text::after {
    content: '';
    order: 3;
    flex-basis: 100%;
    height: 0;
  }

  .name {
    order: 1;
    max-width: 100%;
    overflow: hidden;
    font: 700 14px var(--font-display);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pills {
    order: 2;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .pills:empty {
    display: none;
  }

  .clock {
    flex: none;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    padding-left: var(--space-3);
    border-left: 1.5px solid color-mix(in srgb, var(--c) 25%, var(--line));
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .start {
    font: 700 17px/1.1 var(--font-mono);
    color: var(--fg);
  }

  .card.conflict .start {
    color: var(--bad);
  }

  .end {
    font: 500 11px var(--font-mono);
    color: var(--muted);
    white-space: nowrap;
  }

  .meta {
    order: 5;
    font-size: 12px;
    color: var(--muted);
  }

  .chip {
    padding: 1px 7px;
    border-radius: 6px;
    font-size: 10.5px;
  }

  .gpx {
    background: var(--ok-soft);
    color: var(--ok);
  }

  .late {
    background: var(--bad-soft);
    color: var(--bad);
  }

  .fixed {
    gap: 3px;
    background: color-mix(in srgb, var(--type-air) 16%, transparent);
    color: var(--type-air);
  }

  .booking {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  /* Actions en surimpression au survol : elles ne prennent pas de largeur au texte. */
  /* À gauche, sur l'icône : l'heure, à droite, reste visible au survol. */
  .actions {
    position: absolute;
    top: var(--space-1);
    left: var(--space-1);
    bottom: var(--space-1);
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--c) var(--card-tint), var(--surface));
    opacity: 0;
    transition: opacity 0.12s;
  }

  .card:hover .actions,
  .card:focus-within .actions {
    opacity: 1;
  }

  .actions button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 22px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .actions button:hover {
    background: var(--surface);
    color: var(--fg);
  }
</style>
