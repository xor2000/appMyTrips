import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeLeg } from '#lib/test/fixtures.ts';
import LegTile from './LegTile.svelte';

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    pair: { fromKey: 'a', toKey: 'b' },
    leg: null,
    canEdit: true,
    highlighted: false,
    suggestion: null,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onHover: vi.fn(),
    ...overrides,
  };
  render(LegTile, { props });
  return props;
}

describe('LegTile', () => {
  it('sans trajet : tuile « + trajet » avec raccourcis de mode', async () => {
    const props = setup();
    expect(screen.getByText('+ trajet')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Trajet en Voiture' }));
    expect(props.onCreate).toHaveBeenCalledWith({ mode: 'car' });
    expect(screen.getByRole('button', { name: 'Trajet en Train' })).toBeTruthy();
  });

  it('en lecture seule : trajet à définir, sans raccourci', () => {
    setup({ canEdit: false });
    expect(screen.getByText('Trajet à définir')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Trajet en/ })).toBeNull();
  });

  it('avec trajet : mode, durée, distance et origine des valeurs ; clic pour modifier', async () => {
    const leg = makeLeg();
    const props = setup({ leg });
    const tile = screen.getByRole('button', { name: /Voiture/ });
    expect(tile.textContent).toContain('1 h 15');
    expect(tile.textContent).toContain('72 km');
    expect(tile.textContent).toContain('routeur');
    await fireEvent.click(tile);
    expect(props.onEdit).toHaveBeenCalledWith(leg);
  });

  it('valeur forcée et lignes de transport', () => {
    setup({
      leg: makeLeg({ mode: 'train', durationSource: 'manual', summary: 'TER 17611 → Bus 3' }),
    });
    const tile = screen.getByRole('button', { name: /Train/ });
    expect(tile.textContent).toContain('forcé');
    expect(tile.textContent).toContain('TER 17611 → Bus 3');
  });

  it('propose de reprendre un trajet saisi à la main', async () => {
    const suggestion = makeLeg({
      durationSource: 'manual',
      durationMin: 65,
      distanceSource: 'manual',
      distanceM: 50_000,
    });
    const props = setup({ suggestion });
    await fireEvent.click(screen.getByRole('button', { name: 'Reprendre : Voiture 1 h 05' }));
    expect(props.onCreate).toHaveBeenCalledWith({
      mode: 'car',
      durationMin: 65,
      distanceM: 50_000,
    });
  });
});
