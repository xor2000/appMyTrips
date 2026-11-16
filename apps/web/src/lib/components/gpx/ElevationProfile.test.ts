import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ElevationProfile from './ElevationProfile.svelte';

describe('ElevationProfile', () => {
  it('dessine le profil altimétrique avec un résumé accessible', () => {
    render(ElevationProfile, {
      props: {
        track: [
          [45.9, 6.13, 450],
          [45.92, 6.16, 760],
          [45.95, 6.2, 1070],
        ],
      },
    });
    const svg = screen.getByRole('img', {
      name: /Profil altimétrique : 450 m → 1\s070 m sur 7,\d km/,
    });
    expect(svg.querySelector('path')).toBeTruthy();
  });

  it('rien à dessiner sans altitude', () => {
    const { container } = render(ElevationProfile, {
      props: {
        track: [
          [45.9, 6.13, null],
          [45.95, 6.2, null],
        ],
      },
    });
    expect(container.querySelector('svg')).toBeNull();
  });
});
