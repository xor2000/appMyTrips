<script lang="ts">
  import { STEP_TYPE_INFO, type ScheduledItem, type Step } from '@mytrips/core';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronUp from 'lucide-svelte/icons/chevron-up';
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
    /** Colonne d'heures à gauche de la carte (timeline d'un jour). */
    timeColumn?: boolean;
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
    timeColumn = false,
  }: Props = $props();

  const info = $derived(step.type ? STEP_TYPE_INFO[step.type] : null);
  const late = $derived(
    time?.issues.reduce((t, i) => t + (i.kind === 'conflict' ? i.lateMin : 0), 0) ?? 0,
  );
  const times = $derived.by(() => {
    if (!time || step.kind === 'group') return null;
    const offset = time.end.dayOffset > 0 ? ` (+${time.end.dayOffset} j)` : '';
    return `${time.start.time} → ${time.end.time}${offset}`;
  });
  const Icon = $derived(
    step.type ? STEP_ICONS[step.type] : step.kind === 'group' ? GROUP_ICON : null,
  );
</script>

{#if time && time.freeBeforeMin >= 5}
  <p class="free">⧗ {formatDuration(time.freeBeforeMin)} libre</p>
{/if}
<div
  class="card"
  class:with-clock={timeColumn}
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
  {#if timeColumn}
    <!-- Heure de début dans la colonne de gauche (l'horaire complet reste dans la carte). -->
    <span class="clock" data-testid="step-clock" aria-hidden="true">{time?.start.time ?? ''}</span>
  {/if}
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
        {#if times}<span class="times">{times}</span>{/if}
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
  /* Avec colonne d'heures : grille « heure | carte », comme l'agenda de la maquette. */
  .card.with-clock {
    display: grid;
    grid-template-columns: var(--clock-width) 1fr;
    gap: var(--clock-gap);
  }

  .card[draggable='true'] {
    cursor: grab;
  }

  .clock {
    padding-top: 15px;
    font: 500 11px var(--font-mono);
    color: var(--muted);
    text-align: right;
  }

  .box {
    position: relative;
    display: flex;
    align-items: stretch;
    min-width: 0;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--c) 11%, var(--surface));
    box-shadow: 0 2px 0 color-mix(in srgb, var(--c) 30%, transparent);
    transition:
      box-shadow 0.15s,
      transform 0.15s;
  }

  .card.conflict .box {
    box-shadow: 0 0 0 2px var(--bad);
  }

  .card.highlighted .box {
    box-shadow: 0 0 0 2px var(--c);
    transform: translateX(2px);
  }

  .free {
    margin: 0;
    padding: var(--space-1) 0 var(--space-1) var(--leg-indent, var(--space-6));
    color: var(--ok);
    font: 600 11px var(--font-mono);
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
    border-radius: 50%;
    background: var(--c);
    color: var(--on-type);
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

  .times {
    order: 4;
    font: 500 11.5px var(--font-mono);
    color: var(--fg);
  }

  .times::after {
    content: ' ·';
    color: var(--muted);
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
  .actions {
    position: absolute;
    top: var(--space-1);
    right: var(--space-1);
    bottom: var(--space-1);
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--c) 11%, var(--surface));
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
