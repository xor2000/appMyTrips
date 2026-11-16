<script lang="ts">
  import { elevationProfile, type GpxData } from '@mytrips/core';
  import { formatKm } from '#lib/format.ts';

  interface Props {
    track: GpxData['track'];
  }

  let { track }: Props = $props();

  const WIDTH = 320;
  const HEIGHT = 90;
  const profile = $derived(elevationProfile(track));
  const shape = $derived.by(() => {
    if (profile.length < 2) return null;
    const total = profile[profile.length - 1]!.distanceM || 1;
    const eles = profile.map((p) => p.ele);
    const min = Math.min(...eles);
    const max = Math.max(...eles);
    const span = Math.max(max - min, 1);
    const pts = profile.map((p) => [
      (p.distanceM / total) * WIDTH,
      HEIGHT - 4 - ((p.ele - min) / span) * (HEIGHT - 8),
    ]);
    const line = pts
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)},${y!.toFixed(1)}`)
      .join('');
    return { line, area: `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`, min, max, total };
  });
  const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} m`;
</script>

{#if shape}
  <svg
    class="profile"
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    preserveAspectRatio="none"
    role="img"
    aria-label={`Profil altimétrique : ${fmt(shape.min)} → ${fmt(shape.max)} sur ${formatKm(shape.total)}`}
  >
    <path class="area" d={shape.area} />
    <path class="line" d={shape.line} />
  </svg>
{/if}

<style>
  .profile {
    width: 100%;
    height: 90px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }

  .area {
    fill: color-mix(in srgb, var(--type-hike) 25%, transparent);
  }

  .line {
    fill: none;
    stroke: var(--type-hike);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
</style>
