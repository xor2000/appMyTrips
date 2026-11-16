import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DayTabs from './DayTabs.svelte';

const days = [
  { id: 'd1', date: '2026-07-10', dayStart: null, dayEnd: null, notes: '' },
  { id: 'd2', date: '2026-07-11', dayStart: null, dayEnd: null, notes: '' },
  { id: 'd3', date: '2026-07-12', dayStart: null, dayEnd: null, notes: '' },
];

describe('DayTabs', () => {
  it('affiche « Tout le voyage » puis un onglet par jour', () => {
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Tout le voyage',
      'J1 ven. 10 juil.',
      'J2 sam. 11 juil.',
      'J3 dim. 12 juil.',
    ]);
  });

  it('pastille d’alerte sur un jour en conflit ou qui déborde', () => {
    render(DayTabs, {
      props: { days, selected: null, onSelect: vi.fn(), alerts: new Set(['d2']) },
    });
    expect(screen.getByRole('tab', { name: /J2.*à revoir/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /J1.*à revoir/ })).toBeNull();
  });

  it('marque l’onglet sélectionné', () => {
    render(DayTabs, { props: { days, selected: 'd2', onSelect: vi.fn() } });
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('J2');
  });

  it('sélectionne « Tout le voyage » quand aucun jour n’est choisi', () => {
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('Tout le voyage');
  });

  it('signale le jour choisi, ou null pour tout le voyage', async () => {
    const onSelect = vi.fn();
    render(DayTabs, { props: { days, selected: null, onSelect } });
    await fireEvent.click(screen.getByRole('tab', { name: /J3/ }));
    expect(onSelect).toHaveBeenLastCalledWith('d3');
    await fireEvent.click(screen.getByRole('tab', { name: 'Tout le voyage' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
