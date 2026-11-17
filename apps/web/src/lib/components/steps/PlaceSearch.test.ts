import type { Place } from '@mytrips/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PlaceSearch from './PlaceSearch.svelte';

const louvre: Place = {
  name: 'Musée du Louvre',
  address: 'Rue de Rivoli, 75001 Paris',
  lat: 48.8606,
  lng: 2.3376,
  type: 'museum',
  osmRef: 'W1',
};

describe('PlaceSearch', () => {
  it('cherche à partir de 2 caractères et propose les résultats', async () => {
    const search = vi.fn().mockResolvedValue([louvre]);
    const onPick = vi.fn();
    render(PlaceSearch, { props: { search, onPick, delay: 0 } });
    const input = screen.getByRole('searchbox', { name: 'Rechercher un lieu' });
    await fireEvent.input(input, { target: { value: 'L' } });
    expect(search).not.toHaveBeenCalled();
    await fireEvent.input(input, { target: { value: 'Louvre' } });
    const result = await screen.findByRole('button', { name: /Musée du Louvre/ });
    expect(search).toHaveBeenLastCalledWith('Louvre');
    expect(result.textContent).toContain('Rue de Rivoli');
    await fireEvent.click(result);
    expect(onPick).toHaveBeenCalledWith(louvre);
  });

  it('résultats en double : la liste s’affiche sans planter', async () => {
    const sansRef = { ...louvre, osmRef: null };
    render(PlaceSearch, {
      props: {
        search: vi.fn().mockResolvedValue([louvre, louvre, sansRef, sansRef]),
        onPick: vi.fn(),
        delay: 0,
      },
    });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'Louvre' } });
    expect(await screen.findAllByRole('button', { name: /Musée du Louvre/ })).toHaveLength(4);
  });

  it('indique quand rien n’est trouvé', async () => {
    render(PlaceSearch, {
      props: { search: vi.fn().mockResolvedValue([]), onPick: vi.fn(), delay: 0 },
    });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(await screen.findByText('Aucun lieu trouvé.')).toBeTruthy();
  });

  it('affiche l’erreur de recherche', async () => {
    const search = vi.fn().mockRejectedValue(new Error('La recherche de lieux est indisponible.'));
    render(PlaceSearch, { props: { search, onPick: vi.fn(), delay: 0 } });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'Louvre' } });
    expect((await screen.findByRole('alert')).textContent).toContain('indisponible');
  });
});
