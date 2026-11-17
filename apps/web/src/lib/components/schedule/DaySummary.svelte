<script lang="ts">
  import type { DaySummary } from '@mytrips/core';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  import { formatDuration, plural } from '#lib/format.ts';

  interface Props {
    summary: DaySummary;
    canEdit: boolean;
    onReorganize: () => void;
  }

  let { summary, canEdit, onReorganize }: Props = $props();

  const total = $derived(
    Math.max(1, summary.onSiteMin + summary.travelMin + summary.freeMin + summary.overrunMin),
  );
  const segments = $derived(
    [
      { key: 'site', label: 'Sur place', min: summary.onSiteMin },
      { key: 'travel', label: 'Trajets', min: summary.travelMin },
      { key: 'free', label: 'Libre', min: summary.freeMin },
      { key: 'overrun', label: 'Dépassement', min: summary.overrunMin },
    ].filter((s) => s.min > 0),
  );
  const problems = $derived(
    [
      summary.overrunMin > 0 && `Dépasse la journée de ${formatDuration(summary.overrunMin)}`,
      summary.conflictCount > 0 && plural(summary.conflictCount, 'conflit'),
      summary.missingLegs > 0 &&
        plural(summary.missingLegs, 'trajet manquant', 'trajets manquants'),
    ].filter((p): p is string => typeof p === 'string'),
  );
  const fixable = $derived(summary.overrunMin > 0 || summary.conflictCount > 0);
</script>

{#if segments.length > 0}
  <div
    class="bar"
    role="img"
    aria-label={segments.map((s) => `${s.label} ${formatDuration(s.min)}`).join(' · ')}
  >
    {#each segments as s (s.key)}
      <span
        class={`segment ${s.key}`}
        style={`flex-grow: ${s.min / total}`}
        title={`${s.label} : ${formatDuration(s.min)}`}
      ></span>
    {/each}
  </div>
  <!-- Légende chiffrée (la barre porte déjà le même texte pour les lecteurs d'écran). -->
  <p class="legend" data-testid="day-legend" aria-hidden="true">
    {#each segments as s (s.key)}
      <span class={`key ${s.key}`}>{s.label.toLowerCase()} {formatDuration(s.min)}</span>
    {/each}
  </p>
{/if}

{#if problems.length > 0}
  <div class="banner" role="status">
    <TriangleAlert size={16} />
    <span class="text">{problems.join(' · ')}</span>
    {#if canEdit && fixable}
      <button type="button" class="fix" onclick={onReorganize}>Réorganiser</button>
    {/if}
  </div>
{/if}

<style>
  .bar {
    display: flex;
    height: 8px;
    border-radius: var(--radius-pill);
    overflow: hidden;
    background: var(--bg);
  }

  .segment {
    flex-basis: 0;
    min-width: 4px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }

  .key::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: var(--space-1);
    border-radius: 2px;
    background: var(--c);
  }

  /* Couleurs de la maquette : sur place sarcelle, trajets orange, libre vert, dépassement rouge. */
  .site {
    --c: var(--accent);
    background: var(--c);
  }

  .travel {
    --c: var(--type-food);
    background: var(--c);
  }

  .free {
    --c: var(--ok);
    background: var(--c);
  }

  .overrun {
    --c: var(--bad);
    background: var(--c);
  }

  .key {
    background: none;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 12.5px;
    font-weight: 600;
  }

  .text {
    flex: 1;
  }

  .fix {
    flex: none;
    padding: var(--space-1) var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--warn);
    color: var(--on-warn);
    font: 600 12px var(--font-display);
    cursor: pointer;
  }

  .fix:hover {
    filter: brightness(1.08);
  }
</style>
