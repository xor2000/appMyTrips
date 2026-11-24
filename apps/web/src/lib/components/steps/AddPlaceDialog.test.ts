import type { Place } from '@mytrips/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import AddPlaceDialog from './AddPlaceDialog.svelte';

const louvre: Place = {
  name: 'Musée du Louvre',
  address: 'Rue de Rivoli, 75001 Paris',
  lat: 48.8606,
  lng: 2.3376,
  type: 'museum',
  osmRef: 'W1',
};

function setup(initialType: 'restaurant' | null = null) {
  const props = {
    title: 'Ajouter un lieu',
    search: vi.fn().mockResolvedValue([louvre]),
    initialType,
    onPick: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
  };
  render(AddPlaceDialog, { props });
  return props;
}

async function pickLouvre() {
  await fireEvent.input(screen.getByRole('searchbox', { name: 'Rechercher un lieu' }), {
    target: { value: 'Louvre' },
  });
  await fireEvent.click(await screen.findByRole('button', { name: /Musée du Louvre/ }));
}

describe('AddPlaceDialog', () => {
  it('fenêtre façon maquette : sous-titre, catégorie en grille (automatique par défaut)', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Ajouter un lieu' });
    const sub = document.getElementById(dialog.getAttribute('aria-describedby') ?? '');
    expect(sub?.textContent).toMatch(/Recherchez/);
    const group = screen.getByRole('group', { name: 'Catégorie' });
    expect(group.querySelector('.cat-grid')).toBeTruthy();
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(8);
    expect(group.querySelectorAll('svg')).toHaveLength(8);
    expect((screen.getByRole('radio', { name: 'Automatique' }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('le focus va à la recherche (pas à la grille des catégories)', () => {
    setup();
    expect(document.activeElement).toBe(
      screen.getByRole('searchbox', { name: 'Rechercher un lieu' }),
    );
  });

  it('automatique : le type deviné par la recherche', async () => {
    const props = setup();
    await pickLouvre();
    expect(props.onPick).toHaveBeenCalledWith(louvre, 'museum');
  });

  it('catégorie choisie : imposée au lieu ajouté', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('radio', { name: 'Monument' }));
    await pickLouvre();
    expect(props.onPick).toHaveBeenCalledWith(louvre, 'monument');
  });

  it('catégorie proposée à l’ouverture (bouton « + Restaurant »)', () => {
    setup('restaurant');
    expect((screen.getByRole('radio', { name: 'Restaurant' }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('pied de fenêtre : Annuler', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
