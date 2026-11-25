import type { Place } from '@mytrips/core';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SearchPanel from './SearchPanel.svelte';

const louvre: Place = {
  name: 'Musée du Louvre',
  address: 'Rue de Rivoli, 75001 Paris',
  lat: 48.8606,
  lng: 2.3376,
  type: 'museum',
  osmRef: 'N1000',
};
const orsay: Place = { ...louvre, name: 'Musée d’Orsay', osmRef: 'N2000' };
const station: Place = {
  name: 'Louvre-Rivoli',
  address: 'Paris',
  lat: 48.8608,
  lng: 2.3409,
  type: 'station',
  osmRef: null,
};

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    search: vi.fn().mockResolvedValue([station, louvre, orsay]),
    addedRefs: new Set(['N2000']),
    selected: null as Place | null,
    onSelect: vi.fn(),
    onContextMenu: vi.fn(),
    onBack: vi.fn(),
    delay: 0,
    ...overrides,
  };
  render(SearchPanel, { props });
  return props;
}

async function type(value: string) {
  await fireEvent.input(screen.getByRole('searchbox', { name: 'Rechercher un lieu' }), {
    target: { value },
  });
}

describe('SearchPanel (« Rechercher » dans le panneau gauche)', () => {
  it('panneau « Rechercher » : titre, retour au jour et champ qui reçoit le focus', async () => {
    const props = setup();
    const panel = screen.getByRole('region', { name: 'Rechercher' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Rechercher' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    await fireEvent.click(screen.getByRole('button', { name: 'Retour au jour' }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('à la saisie, résultats groupés par type : titre avec icône et nombre, filet', async () => {
    const props = setup();
    await type('Louvre');
    const results = await screen.findByRole('group', { name: 'Résultats' });
    expect(props.search).toHaveBeenLastCalledWith('Louvre');
    const titles = within(results).getAllByRole('heading', { level: 3 });
    expect(titles.map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Musée 2 lieux',
      'Gare 1 lieu',
    ]);
    expect(titles.every((t) => t.querySelector('svg'))).toBe(true);
    expect(within(results).getByRole('list', { name: /Musée/ }).children).toHaveLength(2);
    const louvreItem = within(results).getByRole('listitem', { name: 'Musée du Louvre' });
    expect(louvreItem.textContent).toContain('Rue de Rivoli');
  });

  it('aucun bouton d’action sur les lignes ; un lieu déjà ajouté est marqué', async () => {
    setup();
    await type('Louvre');
    const results = await screen.findByRole('group', { name: 'Résultats' });
    for (const item of within(results).getAllByRole('listitem')) {
      expect(within(item).getAllByRole('button')).toHaveLength(1);
    }
    const orsayItem = within(results).getByRole('listitem', { name: 'Musée d’Orsay' });
    expect(within(orsayItem).getByText('Déjà ajouté')).toBeTruthy();
  });

  it('clic gauche : sélection du lieu ; clic droit : menu contextuel au pointeur', async () => {
    const props = setup();
    await type('Louvre');
    await fireEvent.click(await screen.findByRole('button', { name: /^Musée du Louvre/ }));
    expect(props.onSelect).toHaveBeenCalledWith(louvre);
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 60,
    });
    screen.getByRole('button', { name: /^Louvre-Rivoli/ }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(props.onContextMenu).toHaveBeenCalledWith(station, { x: 40, y: 60 });
  });

  it('lieu sélectionné mis en évidence dans la liste', async () => {
    setup({ selected: louvre });
    await type('Louvre');
    const item = await screen.findByRole('listitem', { name: 'Musée du Louvre' });
    expect(item.classList.contains('selected')).toBe(true);
    expect(
      screen.getByRole('listitem', { name: 'Musée d’Orsay' }).classList.contains('selected'),
    ).toBe(false);
  });

  it('aucun résultat : message', async () => {
    setup({ search: vi.fn().mockResolvedValue([]) });
    await type('Introuvable');
    expect(await screen.findByText('Aucun lieu trouvé.')).toBeTruthy();
  });
});
