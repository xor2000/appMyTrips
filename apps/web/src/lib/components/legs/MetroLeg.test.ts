import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeLeg } from '#lib/test/fixtures.ts';
import MetroLeg from './MetroLeg.svelte';

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
  render(MetroLeg, { props });
  return props;
}

describe('MetroLeg', () => {
  it('trajet défini : compact, infos en colonne comme une station ; clic pour modifier', async () => {
    const leg = makeLeg();
    const props = setup({ leg });
    const el = screen.getByTestId('metro-leg');
    expect(el.querySelector('.duration')?.textContent).toBe('1 h 15');
    expect(el.textContent).toContain('Voiture');
    expect(el.textContent).toContain('72 km');
    expect(screen.queryByRole('button', { name: /^Trajet en/ })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /Modifier le trajet/ }));
    expect(props.onEdit).toHaveBeenCalledWith(leg);
  });

  it('trajet à définir : un « + » qui se déplie pour choisir le mode', async () => {
    const props = setup();
    const add = screen.getByRole('button', { name: 'Ajouter un trajet' });
    expect(add.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Trajet en Voiture' })).toBeNull();
    await fireEvent.click(add);
    expect(add.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('button', { name: /^Trajet en/ })).toHaveLength(7);
    await fireEvent.click(screen.getByRole('button', { name: 'Trajet en Train' }));
    expect(props.onCreate).toHaveBeenCalledWith({ mode: 'train' });
  });

  it('propose de reprendre un trajet saisi à la main, une fois déplié', async () => {
    const suggestion = makeLeg({ durationSource: 'manual', durationMin: 35 });
    const props = setup({ suggestion });
    await fireEvent.click(screen.getByRole('button', { name: 'Ajouter un trajet' }));
    await fireEvent.click(screen.getByRole('button', { name: /Reprendre : Voiture 35 min/ }));
    expect(props.onCreate).toHaveBeenCalledWith({ mode: 'car', durationMin: 35 });
  });

  it('lecture seule : « Trajet à définir », sans bouton', () => {
    setup({ canEdit: false });
    expect(screen.getByText('Trajet à définir')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ajouter un trajet' })).toBeNull();
  });

  it('signale le survol avec la clé de la paire', async () => {
    const props = setup({ leg: makeLeg() });
    await fireEvent.mouseEnter(screen.getByTestId('metro-leg'));
    expect(props.onHover).toHaveBeenLastCalledWith('a>b');
  });
});
