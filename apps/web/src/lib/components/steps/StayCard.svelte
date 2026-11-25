<script lang="ts">
  import type { StayItem } from '@mytrips/core';
  import { STAY_ICON } from '#lib/steps/icons.ts';

  interface Props {
    item: StayItem;
    highlighted: boolean;
    onEdit: (item: StayItem) => void;
  }

  let { item, highlighted, onEdit }: Props = $props();

  const labels = {
    'check-in': 'Check-in',
    'check-out': 'Check-out',
    départ: 'Départ',
    retour: 'Retour',
  };
  const time = $derived(item.edge === 'start' ? item.stay.checkOutTime : item.stay.checkInTime);
  const Icon = STAY_ICON;
</script>

<button
  type="button"
  class="stay"
  class:highlighted
  data-testid="stay-card"
  onclick={() => onEdit(item)}
>
  <span class="icon"><Icon size={16} /></span>
  <span class="text">
    <span class="name">{item.stay.name}</span>
    <span class="meta">{labels[item.label]} · {time}</span>
  </span>
</button>

<style>
  .stay {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1.5px dashed color-mix(in srgb, var(--type-hotel) 45%, transparent);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--type-hotel) 6%, var(--surface));
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }

  .stay.highlighted {
    border-style: solid;
    border-color: var(--type-hotel);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--type-hotel);
    color: var(--on-type);
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .name {
    font: 600 14px var(--font-display);
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }
</style>
