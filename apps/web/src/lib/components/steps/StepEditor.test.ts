import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { days, makeStep } from '#lib/test/fixtures.ts';
import StepEditor from './StepEditor.svelte';

function setup(step = makeStep()) {
  const props = {
    step,
    days,
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    onImportGpx: vi.fn().mockResolvedValue(undefined),
    onRemoveGpx: vi.fn().mockResolvedValue(undefined),
  };
  render(StepEditor, { props });
  return props;
}

describe('StepEditor', () => {
  it('pré-remplit les champs de l’étape', () => {
    setup(makeStep({ bookingRef: 'AB12', notes: 'Coupe-file' }));
    expect(screen.getByRole('dialog', { name: 'Modifier l’étape' })).toBeTruthy();
    expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('Musée du Louvre');
    expect((screen.getByLabelText('Type') as HTMLSelectElement).value).toBe('museum');
    expect((screen.getByLabelText('Durée sur place (min)') as HTMLInputElement).value).toBe('120');
    expect((screen.getByLabelText('N° de réservation') as HTMLInputElement).value).toBe('AB12');
    expect((screen.getByLabelText('Jour') as HTMLSelectElement).value).toBe('d1');
  });

  it('n’envoie que les champs modifiés', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('Durée sur place (min)'), {
      target: { value: '150' },
    });
    await fireEvent.click(screen.getByLabelText('Heure fixe'));
    await fireEvent.input(screen.getByLabelText('Heure'), { target: { value: '10:30' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ durationMin: 150, fixedStart: '10:30' });
  });

  it('déplace l’étape vers un autre jour ou vers les idées', async () => {
    const props = setup();
    await fireEvent.change(screen.getByLabelText('Jour'), { target: { value: '' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ dayId: null });
  });

  it('affiche et modifie les horaires d’ouverture', async () => {
    const props = setup(makeStep({ openingHours: 'Mo-Su 09:00-18:00' }));
    const field = screen.getByLabelText('Horaires d’ouverture') as HTMLInputElement;
    expect(field.value).toBe('Mo-Su 09:00-18:00');
    await fireEvent.input(field, { target: { value: 'Mo,We-Su 09:00-18:00' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ openingHours: 'Mo,We-Su 09:00-18:00' });
  });

  it('retire l’heure fixe', async () => {
    const props = setup(makeStep({ fixedStart: '09:00' }));
    await fireEvent.click(screen.getByLabelText('Heure fixe'));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ fixedStart: null });
  });

  it('refuse un lien de réservation invalide', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('Lien de réservation'), {
      target: { value: 'pas un lien' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/lien/i);
  });

  it('pour un dossier, ne propose que le nom, le jour et les notes', () => {
    setup(makeStep({ kind: 'group', type: null, name: 'Vieux-Port', lat: null, lng: null }));
    expect(screen.getByRole('dialog', { name: 'Modifier le dossier' })).toBeTruthy();
    expect(screen.queryByLabelText('Type')).toBeNull();
    expect(screen.queryByLabelText('Durée sur place (min)')).toBeNull();
  });

  it('supprime l’étape', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(props.onDelete).toHaveBeenCalled();
  });
});

const HIKE = makeStep({
  type: 'hike',
  name: 'Tournette',
  durationMin: 215,
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
});

describe('StepEditor · randonnée', () => {
  it('affiche distance, D+, profil, et coche le dénivelé', async () => {
    const props = setup(HIKE);
    expect(screen.getByText(/12,4 km · D\+ 620 m · D− 20 m/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Profil altimétrique/ })).toBeTruthy();
    await fireEvent.click(screen.getByLabelText('Inclure le dénivelé (+1 h / 600 m)'));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ useElevation: true });
  });

  it('dénivelé inconnu : option désactivée', () => {
    setup(
      makeStep({
        type: 'hike',
        gpx: { ...HIKE.gpx!, stats: { ...HIKE.gpx!.stats, ascentM: null } },
      }),
    );
    expect(
      (screen.getByLabelText('Inclure le dénivelé (+1 h / 600 m)') as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('importe un GPX et retire le tracé', async () => {
    const props = setup(HIKE);
    const file = new File(['<gpx/>'], 'tour.gpx', { type: 'application/gpx+xml' });
    await fireEvent.change(screen.getByLabelText('Importer un GPX'), { target: { files: [file] } });
    expect(props.onImportGpx).toHaveBeenCalledWith(file);
    await fireEvent.click(screen.getByRole('button', { name: 'Retirer le GPX' }));
    expect(props.onRemoveGpx).toHaveBeenCalled();
  });

  it('une étape qui n’est pas une randonnée n’a pas d’import GPX', () => {
    setup();
    expect(screen.queryByLabelText('Importer un GPX')).toBeNull();
  });
});
