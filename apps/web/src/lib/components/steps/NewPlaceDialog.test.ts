import type { Place } from '@mytrips/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import NewPlaceDialog from './NewPlaceDialog.svelte';

const louvre: Place = {
  name: 'Musée du Louvre',
  address: 'Rue de Rivoli, 75001 Paris',
  lat: 48.8606,
  lng: 2.3376,
  type: 'museum',
  osmRef: 'W1',
};

const pointPlace: Place = {
  name: 'Point sur la carte',
  address: null,
  lat: 45.9,
  lng: 6.12,
  type: 'other',
  osmRef: null,
};

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    search: vi.fn().mockResolvedValue([louvre]),
    locate: vi.fn().mockResolvedValue(pointPlace),
    onPickOnMap: vi.fn().mockResolvedValue({ lat: 45.9, lng: 6.12 }),
    onChoose: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(NewPlaceDialog, { props });
  return props;
}

const tab = (name: string) => screen.getByRole('radio', { name });

describe('NewPlaceDialog', () => {
  it('trois façons de choisir le lieu ; « Rechercher » par défaut, focus sur la recherche', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Ajouter un lieu' })).toBeTruthy();
    expect((tab('Rechercher') as HTMLInputElement).checked).toBe(true);
    expect(tab('Sur la carte')).toBeTruthy();
    expect(tab('Coordonnées')).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('searchbox', { name: 'Rechercher un lieu' }),
    );
  });

  it('peut s’ouvrir sur un autre onglet', () => {
    setup({ initialTab: 'coords' });
    expect((tab('Coordonnées') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText('Latitude')).toBeTruthy();
  });

  it('recherche : le lieu choisi est transmis tel quel', async () => {
    const props = setup();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Rechercher un lieu' }), {
      target: { value: 'Louvre' },
    });
    await fireEvent.click(await screen.findByRole('button', { name: /Musée du Louvre/ }));
    expect(props.onChoose).toHaveBeenCalledWith(louvre);
  });

  it('coordonnées : le point est situé (géocodage inverse) puis transmis', async () => {
    const props = setup();
    await fireEvent.click(tab('Coordonnées'));
    await fireEvent.input(screen.getByLabelText('Latitude'), { target: { value: '45.9, 6.12' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Utiliser ce point' }));
    await waitFor(() => expect(props.onChoose).toHaveBeenCalledWith(pointPlace));
    expect(props.locate).toHaveBeenCalledWith({ lat: 45.9, lng: 6.12 });
  });

  it('coordonnées invalides : message, rien n’est transmis', async () => {
    const props = setup();
    await fireEvent.click(tab('Coordonnées'));
    await fireEvent.input(screen.getByLabelText('Latitude'), { target: { value: '95' } });
    await fireEvent.input(screen.getByLabelText('Longitude'), { target: { value: '2' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Utiliser ce point' }));
    expect(screen.getByRole('alert').textContent).toMatch(/latitude/i);
    expect(props.locate).not.toHaveBeenCalled();
    expect(props.onChoose).not.toHaveBeenCalled();
  });

  it('sur la carte : choix d’un point (fenêtre masquée), puis situé et transmis', async () => {
    const props = setup();
    await fireEvent.click(tab('Sur la carte'));
    await fireEvent.click(screen.getByRole('button', { name: 'Choisir sur la carte' }));
    await waitFor(() => expect(props.onChoose).toHaveBeenCalledWith(pointPlace));
    expect(props.onPickOnMap).toHaveBeenCalled();
    expect(props.locate).toHaveBeenCalledWith({ lat: 45.9, lng: 6.12 });
  });

  it('sur la carte, choix abandonné : rien n’est transmis', async () => {
    const props = setup({ onPickOnMap: vi.fn().mockResolvedValue(null) });
    await fireEvent.click(tab('Sur la carte'));
    await fireEvent.click(screen.getByRole('button', { name: 'Choisir sur la carte' }));
    await waitFor(() => expect(props.onPickOnMap).toHaveBeenCalled());
    expect(props.onChoose).not.toHaveBeenCalled();
  });

  it('fenêtre fermée pendant la recherche du point : la réponse tardive est ignorée', async () => {
    let answer: (place: Place) => void = () => {};
    const locate = vi.fn(() => new Promise<Place>((resolve) => (answer = resolve)));
    const onChoose = vi.fn();
    const view = render(NewPlaceDialog, {
      props: { search: vi.fn(), locate, onChoose, onClose: vi.fn(), initialTab: 'coords' },
    });
    await fireEvent.input(screen.getByLabelText('Latitude'), { target: { value: '45.9, 6.12' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Utiliser ce point' }));
    expect(locate).toHaveBeenCalled();
    view.unmount();
    answer(pointPlace);
    await Promise.resolve();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('onglet « Sur la carte » demandé sans carte : la recherche à la place', () => {
    setup({ onPickOnMap: undefined, initialTab: 'map' });
    expect((tab('Rechercher') as HTMLInputElement).checked).toBe(true);
  });

  it('sans carte (plein écran) : pas d’onglet « Sur la carte »', () => {
    setup({ onPickOnMap: undefined });
    expect(screen.queryByRole('radio', { name: 'Sur la carte' })).toBeNull();
  });
});
