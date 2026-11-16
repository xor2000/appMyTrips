import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeStep } from '#lib/test/fixtures.ts';
import StepCard from './StepCard.svelte';

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    step: makeStep(),
    label: '1',
    canEdit: true,
    highlighted: false,
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onHover: vi.fn(),
    ...overrides,
  };
  render(StepCard, { props });
  return props;
}

describe('StepCard', () => {
  it('affiche le numéro, le nom, le type et la durée sur place', () => {
    setup();
    expect(screen.getByText('Musée du Louvre')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText(/Musée · 2 h sur place/)).toBeTruthy();
  });

  it('affiche un dossier comme tel (sans durée)', () => {
    setup({
      step: makeStep({ kind: 'group', type: null, name: 'Vieux-Port', lat: null, lng: null }),
    });
    expect(screen.getByText('Dossier')).toBeTruthy();
    expect(screen.queryByText(/sur place/)).toBeNull();
  });

  it('signale une heure fixe et une réservation', () => {
    setup({ step: makeStep({ fixedStart: '10:30', bookingRef: 'AB12' }) });
    expect(screen.getByText('10:30').closest('[title]')?.getAttribute('title')).toBe('Heure fixe');
    expect(screen.getByText('Résa AB12')).toBeTruthy();
  });

  it('ouvre l’éditeur au clic sur la carte', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: /Musée du Louvre Musée/ }));
    expect(props.onEdit).toHaveBeenCalledWith(props.step);
  });

  it('propose de monter, descendre et supprimer l’étape', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Monter Musée du Louvre' }));
    expect(props.onMove).toHaveBeenLastCalledWith(props.step, -1);
    await fireEvent.click(screen.getByRole('button', { name: 'Descendre Musée du Louvre' }));
    expect(props.onMove).toHaveBeenLastCalledWith(props.step, 1);
    await fireEvent.click(screen.getByRole('button', { name: 'Supprimer Musée du Louvre' }));
    expect(props.onDelete).toHaveBeenCalledWith(props.step);
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('en lecture seule, n’affiche aucune action et n’est pas déplaçable', () => {
    setup({ canEdit: false });
    expect(screen.queryByRole('button', { name: /monter/i })).toBeNull();
    expect(screen.getByTestId('step-card').getAttribute('draggable')).toBe('false');
  });

  it('signale le survol (synchronisation avec la carte)', async () => {
    const props = setup();
    await fireEvent.mouseEnter(screen.getByTestId('step-card'));
    expect(props.onHover).toHaveBeenLastCalledWith('s1');
    await fireEvent.mouseLeave(screen.getByTestId('step-card'));
    expect(props.onHover).toHaveBeenLastCalledWith(null);
  });
});
