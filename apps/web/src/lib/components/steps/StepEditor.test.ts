import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { days, makeStep } from '#lib/test/fixtures.ts';
import StepEditor from './StepEditor.svelte';

function setup(
  step = makeStep(),
  onPickOnMap: () => Promise<{ lat: number; lng: number } | null> = vi.fn().mockResolvedValue(null),
) {
  const props = {
    step,
    days,
    onPickOnMap,
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
    const dialog = screen.getByRole('dialog', { name: 'Modifier l’étape' });
    const sub = document.getElementById(dialog.getAttribute('aria-describedby') ?? '');
    expect(sub?.textContent).toBe('Mettez à jour les informations de cette étape.');
    expect((screen.getByLabelText('Nom du lieu') as HTMLInputElement).value).toBe(
      'Musée du Louvre',
    );
    expect((screen.getByRole('radio', { name: 'Musée' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('48.860600');
    expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('2.337600');
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
    expect(screen.queryByRole('group', { name: 'Catégorie' })).toBeNull();
    expect(screen.queryByLabelText('Latitude')).toBeNull();
    expect(screen.queryByLabelText('Durée sur place (min)')).toBeNull();
  });

  it('catégorie en grille de boutons (icône et libellé), comme la maquette', async () => {
    const props = setup();
    const group = screen.getByRole('group', { name: 'Catégorie' });
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(17);
    expect(group.querySelectorAll('svg')).toHaveLength(17);
    await fireEvent.click(screen.getByRole('radio', { name: 'Restaurant' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ type: 'restaurant' });
  });

  it('latitude et longitude modifiables (ensemble)', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('Latitude'), { target: { value: '48.8611' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ lat: 48.8611, lng: 2.3376 });
  });

  it('refuse une latitude hors limites', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('Latitude'), { target: { value: '95' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/latitude/i);
  });

  it('nouvelle position en cliquant sur la carte : fenêtre masquée le temps du choix', async () => {
    let place: (p: { lat: number; lng: number } | null) => void = () => {};
    const pick = vi.fn(
      () => new Promise<{ lat: number; lng: number } | null>((resolve) => (place = resolve)),
    );
    const props = setup(makeStep(), pick);
    await fireEvent.click(screen.getByRole('button', { name: 'Choisir sur la carte' }));
    expect(pick).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    place({ lat: 48.85837009, lng: 2.29448128 });
    await vi.waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('48.858370');
    expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('2.294481');
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).toHaveBeenCalledWith({ lat: 48.85837, lng: 2.294481 });
  });

  it('choix sur la carte annulé : position inchangée', async () => {
    const props = setup(makeStep(), vi.fn().mockResolvedValue(null));
    await fireEvent.click(screen.getByRole('button', { name: 'Choisir sur la carte' }));
    await vi.waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('48.860600');
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('pied de fenêtre comme la maquette : Supprimer, Annuler, Enregistrer', () => {
    setup();
    const labels = Array.from(document.querySelectorAll('.actions button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(['Supprimer', 'Annuler', 'Enregistrer']);
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
