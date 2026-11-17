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

  it('affiche ses heures calculées', () => {
    setup({
      time: {
        key: 's1',
        kind: 'step',
        start: { time: '08:35', dayOffset: 0 },
        end: { time: '10:35', dayOffset: 0 },
        timezone: 'Europe/Paris',
        freeBeforeMin: 0,
        issues: [],
      },
    });
    expect(screen.getByText('08:35 → 10:35')).toBeTruthy();
  });

  it('met en avant l’heure de début, à droite de la carte', () => {
    setup({
      time: {
        key: 's1',
        kind: 'step',
        start: { time: '08:35', dayOffset: 0 },
        end: { time: '10:35', dayOffset: 0 },
        timezone: 'Europe/Paris',
        freeBeforeMin: 0,
        issues: [],
      },
    });
    expect(screen.getByTestId('step-start').textContent).toBe('08:35');
  });

  it('signale un conflit (retard) et le temps libre avant une heure fixe', () => {
    setup({
      step: makeStep({ fixedStart: '10:30' }),
      time: {
        key: 's1',
        kind: 'step',
        start: { time: '10:30', dayOffset: 0 },
        end: { time: '12:30', dayOffset: 0 },
        timezone: 'Europe/Paris',
        freeBeforeMin: 75,
        issues: [{ kind: 'conflict', lateMin: 20 }],
      },
    });
    expect(screen.getByText('Conflit +20 min')).toBeTruthy();
    expect(screen.getByTestId('step-card').classList.contains('conflict')).toBe(true);
    expect(screen.getByText('⧗ 1 h 15 libre')).toBeTruthy();
  });

  it('arrivée le lendemain : « +1 j »', () => {
    setup({
      time: {
        key: 's1',
        kind: 'step',
        start: { time: '01:00', dayOffset: 1 },
        end: { time: '01:30', dayOffset: 1 },
        timezone: 'America/New_York',
        freeBeforeMin: 0,
        issues: [],
      },
    });
    expect(screen.getByText('01:00 → 01:30 (+1 j)')).toBeTruthy();
  });

  it('randonnée GPX : pastilles de distance et de dénivelé', () => {
    setup({
      step: makeStep({
        type: 'hike',
        name: 'Tournette',
        gpx: {
          stats: {
            distanceM: 12_400,
            ascentM: 620,
            descentM: 20,
            minEle: 450,
            maxEle: 1070,
            isLoop: false,
            pointCount: 1200,
          },
          track: [
            [45.9, 6.13, 450],
            [45.95, 6.2, 1070],
          ],
        },
      }),
    });
    expect(screen.getByText('GPX 12,4 km')).toBeTruthy();
    expect(screen.getByText('D+ 620 m')).toBeTruthy();
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
