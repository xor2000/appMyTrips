import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeTripSummary } from '#lib/test/fixtures.ts';
import TripSwitcher from './TripSwitcher.svelte';

const today = '2026-11-17';
const trips = [
  makeTripSummary({ id: 'p', name: 'Lisbonne', startDate: '2026-03-01', endDate: '2026-03-05' }),
  makeTripSummary({ id: 'f', name: 'Alpes', startDate: '2027-02-20', endDate: '2027-02-24' }),
  makeTripSummary({ id: 'c', name: 'Marseille', startDate: '2026-11-15', endDate: '2026-11-18' }),
];

const select = () =>
  screen.getByRole('combobox', { name: 'Choisir un voyage' }) as HTMLSelectElement;

describe('TripSwitcher', () => {
  it('liste les voyages, à venir puis souvenirs, et montre le voyage ouvert', () => {
    render(TripSwitcher, { props: { trips, currentId: 'f', today, onSelect: vi.fn() } });
    expect(select().value).toBe('f');
    const upcoming = screen.getByRole('group', { name: 'En cours et à venir' });
    expect(
      within(upcoming)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Marseille', 'Alpes']);
    const past = screen.getByRole('group', { name: 'Souvenirs' });
    expect(
      within(past)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Lisbonne']);
  });

  it('choisir un autre voyage l’ouvre', async () => {
    const onSelect = vi.fn();
    render(TripSwitcher, { props: { trips, currentId: 'f', today, onSelect } });
    await fireEvent.change(select(), { target: { value: 'p' } });
    expect(onSelect).toHaveBeenCalledWith('p');
  });

  it('hors d’un voyage (Mon compte) : invite à choisir', () => {
    render(TripSwitcher, { props: { trips, currentId: null, today, onSelect: vi.fn() } });
    expect(select().selectedOptions[0]?.textContent).toBe('Choisir un voyage…');
  });

  it('roue crantée et « + » seulement quand l’action est possible', async () => {
    const onSettings = vi.fn();
    const onCreate = vi.fn();
    const { unmount } = render(TripSwitcher, {
      props: { trips, currentId: 'f', today, onSelect: vi.fn(), onSettings, onCreate },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Paramètres du voyage' }));
    expect(onSettings).toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Nouveau voyage' }));
    expect(onCreate).toHaveBeenCalled();
    unmount();

    // Lecteur ou hors ligne : ni paramètres ni création.
    render(TripSwitcher, { props: { trips, currentId: 'f', today, onSelect: vi.fn() } });
    expect(screen.queryByRole('button', { name: 'Paramètres du voyage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nouveau voyage' })).toBeNull();
  });

  it('aucun voyage : pas de liste, seulement « + »', () => {
    render(TripSwitcher, {
      props: { trips: [], currentId: null, today, onSelect: vi.fn(), onCreate: vi.fn() },
    });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nouveau voyage' })).toBeTruthy();
  });
});
