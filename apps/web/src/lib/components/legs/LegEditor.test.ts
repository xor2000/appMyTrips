import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeLeg } from '#lib/test/fixtures.ts';
import LegEditor from './LegEditor.svelte';

function setup(leg = makeLeg()) {
  const props = {
    leg,
    onSave: vi.fn().mockResolvedValue(undefined),
    onRecompute: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };
  render(LegEditor, { props });
  return props;
}

describe('LegEditor', () => {
  it('pré-remplit le trajet', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Modifier le trajet' })).toBeTruthy();
    expect((screen.getByLabelText('Mode') as HTMLSelectElement).value).toBe('car');
    expect((screen.getByLabelText('Distance (km)') as HTMLInputElement).value).toBe('72');
    expect((screen.getByLabelText('Durée (min)') as HTMLInputElement).value).toBe('75');
  });

  it('forcer la durée : n’envoie que la durée', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('Durée (min)'), { target: { value: '45' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ durationMin: 45 });
  });

  it('forcer la distance (km → m) et changer de mode', async () => {
    const props = setup();
    await fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'bike' } });
    await fireEvent.input(screen.getByLabelText('Distance (km)'), { target: { value: '30.5' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ mode: 'bike', distanceM: 30_500 });
  });

  it('heure de départ et réservation pour un train', async () => {
    const props = setup(makeLeg({ mode: 'train' }));
    await fireEvent.input(screen.getByLabelText('Départ à'), { target: { value: '08:12' } });
    await fireEvent.input(screen.getByLabelText('N° de réservation'), { target: { value: 'PNR' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ departAt: '08:12', bookingRef: 'PNR' });
  });

  it('recalculer : retour au routeur', async () => {
    const props = setup(makeLeg({ durationSource: 'manual', durationMin: 45 }));
    await fireEvent.click(screen.getByRole('button', { name: 'Recalculer' }));
    expect(props.onRecompute).toHaveBeenCalled();
  });

  it('refuse une durée nulle', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('Durée (min)'), { target: { value: '0' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('supprimer le trajet', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(props.onDelete).toHaveBeenCalled();
  });
});
