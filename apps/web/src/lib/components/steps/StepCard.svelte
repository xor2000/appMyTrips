<script lang="ts">
  import { STEP_TYPE_INFO, type ScheduledItem, type Step } from '@mytrips/core';
  import Hourglass from 'lucide-svelte/icons/hourglass';
  import Lock from 'lucide-svelte/icons/lock';
  import { formatDuration, formatKm } from '#lib/format.ts';
  import { contextMenuKey, type MenuPoint } from '#lib/steps/contextMenu.ts';
  import { endDrag, startDrag } from '#lib/steps/dnd.svelte.ts';
  import { GROUP_ICON, STEP_ICONS } from '#lib/steps/icons.ts';

  interface Props {
    step: Step;
    /** Numéro affiché sur la carte, s'il y en a un. */
    label?: string | null;
    canEdit: boolean;
    highlighted: boolean;
    onEdit: (step: Step) => void;
    /** Clic droit, touche Menu ou Maj+F10 : menu contextuel (Modifier, Supprimer, Déplacer…). */
    onContextMenu: (step: Step, point: MenuPoint) => void;
    onHover: (key: string | null) => void;
    /** Horaires calculés par le moteur (absents hors d'un jour). */
    time?: ScheduledItem | null;
    /** Variante compacte (colonne des idées) : moins haute. */
    dense?: boolean;
  }

  let {
    step,
    label = null,
    canEdit,
    highlighted,
    onEdit,
    onContextMenu,
    onHover,
    time = null,
    dense = false,
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
  class:dense
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
  oncontextmenu={(e) => {
    e.preventDefault();
    onContextMenu(step, { x: e.clientX, y: e.clientY });
  }}
>
  <div class="box">
    <button
      type="button"
      class="main"
      onclick={() => onEdit(step)}
      onkeydown={(e) => {
        const point = contextMenuKey(e);
        if (point) onContextMenu(step, point);
      }}
    >
      <span class="icon">
        {#if Icon}<Icon size={15} />{/if}
        {#if label}<span class="label">{label}</span>{/if}
      </span>
      <!-- Une seule ligne : nom, type et durée, pastilles (le nom accessible garde la forme
           « nom type… »), puis l'horaire à droite. -->
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
        <!-- Horaire sur une ligne : début en gras, puis fin. Texte lu : « début → fin ». -->
        <span class="clock">
          <span class="visually-hidden">{clock.start} → {clock.end}</span>
          <span class="start" data-testid="step-start" aria-hidden="true">{clock.start}</span>
          <span class="end" aria-hidden="true">→ {clock.end}</span>
        </span>
      {/if}
    </button>
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
    margin: 3px 0;
    padding: 1px var(--space-3);
    border: 1.5px dashed var(--ok);
    border-radius: var(--radius-pill);
    background: var(--ok-soft);
    color: var(--ok);
    font: 700 12px var(--font-display);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 5px var(--space-3) 5px 6px;
    border: 0;
    background: transparent;
    color: var(--fg);
    text-align: left;
    cursor: inherit;
  }

  /* Variante compacte (idées) : icône et marges réduites. */
  .dense .main {
    padding: 2px var(--space-3) 2px 4px;
  }

  .dense .icon {
    width: 22px;
    height: 22px;
  }

  .icon {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
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

  /* Une ligne : le nom se raccourcit d'abord, puis le type ; les pastilles gardent leur place. */
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
    white-space: nowrap;
  }

  .name {
    flex: 0 1 auto;
    min-width: 3em;
    overflow: hidden;
    font: 700 13.5px var(--font-display);
    text-overflow: ellipsis;
  }

  .pills {
    flex: none;
    display: flex;
    gap: var(--space-1);
    align-self: center;
  }

  .pills:empty {
    display: none;
  }

  .clock {
    flex: none;
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding-left: var(--space-2);
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
    font: 700 13.5px var(--font-mono);
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

  /* Le type et la durée cèdent leur place avant le nom (rétrécissement bien plus fort). */
  .meta {
    flex: 0 1000 auto;
    min-width: 0;
    overflow: hidden;
    font-size: 12px;
    color: var(--muted);
    text-overflow: ellipsis;
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
</style>
