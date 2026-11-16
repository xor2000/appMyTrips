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
{/if}

{#if problems.length > 0}
  <div class="banner" role="status">
    <TriangleAlert size={16} />
    <span class="text">{problems.join(' · ')}</span>
    {#if canEdit && fixable}
      <button type="button" class="btn btn-soft" onclick={onReorganize}>Réorganiser</button>
    {/if}
  </div>
{/if}

<style>
  .bar {
    display: flex;
    gap: 2px;
    height: 8px;
    border-radius: var(--radius-pill);
    overflow: hidden;
    background: var(--surface-2);
  }

  .segment {
    flex-basis: 0;
    min-width: 4px;
  }

  .site {
    background: var(--type-museum);
  }

  .travel {
    background: var(--type-transport);
  }

  .free {
    background: var(--ok);
  }

  .overrun {
    background: var(--bad);
  }

  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 13px;
    font-weight: 600;
  }

  .text {
    flex: 1;
  }

  .banner .btn {
    padding: var(--space-1) var(--space-3);
    font-size: 13px;
  }
</style>
