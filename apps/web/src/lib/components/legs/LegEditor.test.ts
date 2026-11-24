import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeLeg } from '#lib/test/fixtures.ts';
import LegEditor from './LegEditor.svelte';

function setup(leg = makeLeg(), extra: { isNew?: boolean; autoColor?: number } = {}) {
  const props = {
    leg,
    autoColor: 2,
    ...extra,
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
    const dialog = screen.getByRole('dialog', { name: 'Modifier le trajet' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toMatch(
      /mode de transport/i,
    );
    expect((screen.getByRole('radio', { name: 'Voiture' }) as HTMLInputElement).checked).toBe(true);
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
    await fireEvent.click(screen.getByRole('radio', { name: 'Vélo' }));
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

  it('mode de transport : un bouton (icône et libellé) par mode, comme la maquette', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Mode de transport' });
    const modes = Array.from(group.querySelectorAll('input[type="radio"]')).map(
      (r) => r.getAttribute('aria-label') ?? r.closest('label')?.textContent?.trim(),
    );
    expect(modes).toEqual(['Voiture', 'Vélo', 'Marche', 'Bus', 'Train', 'Avion', 'Ferry']);
    expect(group.querySelectorAll('svg')).toHaveLength(7);
  });

  it('couleur automatique par défaut (pastille de la couleur suivante du jour)', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Couleur' });
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(9);
    const auto = screen.getByRole('radio', { name: /Automatique/ }) as HTMLInputElement;
    expect(auto.checked).toBe(true);
    expect(auto.closest('label')?.getAttribute('style')).toContain('--leg-3');
  });

  it('choisir une couleur : n’envoie que la couleur', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('radio', { name: 'Bleu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ color: 1 });
  });

  it('revenir à la couleur automatique', async () => {
    const props = setup(makeLeg({ color: 4 }));
    expect((screen.getByRole('radio', { name: 'Orange' }) as HTMLInputElement).checked).toBe(true);
    await fireEvent.click(screen.getByRole('radio', { name: /Automatique/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ color: null });
  });

  it('trajet d’un ancien cache hors ligne (sans couleur) : automatique, rien à enregistrer', async () => {
    const leg = { ...makeLeg() } as Partial<ReturnType<typeof makeLeg>>;
    delete leg.color;
    const props = setup(leg as ReturnType<typeof makeLeg>);
    expect((screen.getByRole('radio', { name: /Automatique/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('nouveau trajet : couleur choisie envoyée avec le mode et la durée', async () => {
    const props = setup(makeLeg({ durationMin: 60 }), { isNew: true });
    expect(screen.getByRole('dialog', { name: 'Nouveau trajet' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('radio', { name: 'Violet' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Ajouter le trajet' }));
    expect(props.onSave).toHaveBeenCalledWith({
      mode: 'car',
      durationMin: 60,
      distanceM: 72_000,
      color: 2,
    });
  });

  it('pied de fenêtre comme la maquette : Supprimer, Annuler, Enregistrer', async () => {
    const props = setup();
    const labels = Array.from(document.querySelectorAll('.actions button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(['Supprimer', 'Recalculer', 'Annuler', 'Enregistrer']);
    await fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('supprimer le trajet', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(props.onDelete).toHaveBeenCalled();
  });
});
