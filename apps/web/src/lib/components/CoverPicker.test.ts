import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeCover } from '#lib/test/fixtures.ts';
import CoverPicker from './CoverPicker.svelte';

const photos = [
  makeCover({ url: 'https://x/1.jpg', thumbUrl: 'https://x/1-640.jpg', author: 'Anne' }),
  makeCover({ url: 'https://x/2.jpg', thumbUrl: 'https://x/2-640.jpg', author: 'Bruno' }),
];

describe('CoverPicker', () => {
  it('cherche des photos pour le voyage et les propose', async () => {
    const search = vi.fn().mockResolvedValue(photos);
    render(CoverPicker, { props: { query: 'Alpes', selected: null, search, onSelect: vi.fn() } });
    expect(search).toHaveBeenCalledWith('Alpes');
    expect(await screen.findByRole('radio', { name: 'Photo 1 : Anne' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Photo 2 : Bruno' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Sans photo' })).toBeTruthy();
  });

  it('choisir une photo, ou aucune', async () => {
    const onSelect = vi.fn();
    render(CoverPicker, {
      props: {
        query: 'Alpes',
        selected: null,
        search: vi.fn().mockResolvedValue(photos),
        onSelect,
      },
    });
    await fireEvent.click(await screen.findByRole('radio', { name: 'Photo 2 : Bruno' }));
    expect(onSelect).toHaveBeenLastCalledWith(photos[1]);
    await fireEvent.click(screen.getByRole('radio', { name: 'Sans photo' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('nouvelle recherche avec d’autres mots', async () => {
    const search = vi.fn().mockResolvedValue(photos);
    render(CoverPicker, { props: { query: 'Alpes', selected: null, search, onSelect: vi.fn() } });
    const input = screen.getByLabelText('Rechercher une photo');
    await fireEvent.input(input, { target: { value: 'Mont Blanc' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Chercher' }));
    expect(search).toHaveBeenLastCalledWith('Mont Blanc');
  });

  it('aucun résultat, ou service indisponible : message clair', async () => {
    const { unmount } = render(CoverPicker, {
      props: {
        query: 'Zzz',
        selected: null,
        search: vi.fn().mockResolvedValue([]),
        onSelect: vi.fn(),
      },
    });
    expect(await screen.findByText('Aucune photo trouvée pour « Zzz ».')).toBeTruthy();
    unmount();
    render(CoverPicker, {
      props: {
        query: 'Alpes',
        selected: null,
        search: vi.fn().mockRejectedValue(new Error('réseau')),
        onSelect: vi.fn(),
      },
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('la photo actuelle reste proposée et cochée', async () => {
    const current = makeCover({ url: 'https://x/actuelle.jpg', author: 'Carla' });
    render(CoverPicker, {
      props: {
        query: 'Alpes',
        selected: current,
        search: vi.fn().mockResolvedValue(photos),
        onSelect: vi.fn(),
      },
    });
    const radio = (await screen.findByRole('radio', {
      name: 'Photo actuelle : Carla',
    })) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('photo actuelle parmi les résultats : numérotation de la recherche, cochée à sa place', async () => {
    render(CoverPicker, {
      props: {
        query: 'Alpes',
        selected: photos[0]!,
        search: vi.fn().mockResolvedValue(photos),
        onSelect: vi.fn(),
      },
    });
    const first = (await screen.findByRole('radio', {
      name: 'Photo 1 : Anne',
    })) as HTMLInputElement;
    expect(first.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'Photo 2 : Bruno' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Photo actuelle/ })).toBeNull();
  });
});
