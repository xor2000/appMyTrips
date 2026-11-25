import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { POI_CATEGORIES, type PoiCategory } from '@mytrips/core';
import { makePoi } from '#lib/test/fixtures.ts';
import ExplorePanel from './ExplorePanel.svelte';

const POIS = [
  makePoi({
    id: 'osm:N2001',
    name: 'Musée des Arts décoratifs',
    openingHours: 'Tu-Su 11:00-18:00',
  }),
  makePoi({ id: 'osm:N1000', osmRef: 'N1000', name: 'Musée du Louvre', wikidata: 'Q19675' }),
  makePoi({
    id: 'osm:N3000',
    osmRef: 'N3000',
    name: 'Café Kitsuné',
    category: 'cafe',
    stepType: 'cafe',
  }),
];

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    categories: ['museum', 'cafe'] as PoiCategory[],
    pois: POIS,
    status: 'ready' as const,
    error: null as string | null,
    zoomTooLow: false,
    stale: false,
    addedRefs: new Set(['N1000']),
    selectedId: null as string | null,
    onToggleCategory: vi.fn(),
    onSetCategories: vi.fn(),
    onSearch: vi.fn(),
    onSelect: vi.fn(),
    onContextMenu: vi.fn(),
    onBack: vi.fn(),
    loadWiki: vi.fn().mockResolvedValue({
      title: 'Musée du Louvre',
      extract: 'Le plus grand musée d’art du monde.',
      thumbnail: 'https://upload.wikimedia.org/louvre.jpg',
      url: 'https://fr.wikipedia.org/wiki/Louvre',
    }),
    ...overrides,
  };
  render(ExplorePanel, { props });
  return props;
}

describe('ExplorePanel', () => {
  it('affiche les pastilles de catégories avec leur compteur, et bascule une catégorie', async () => {
    const props = setup();
    const chips = within(screen.getByRole('group', { name: 'Catégories' }));
    const museums = chips.getByRole('button', { name: /Musées/ });
    expect(museums.getAttribute('aria-pressed')).toBe('true');
    expect(museums.textContent).toContain('2');
    expect(chips.getByRole('button', { name: /Cafés/ }).textContent).toContain('1');
    const parks = chips.getByRole('button', { name: /Parcs/ });
    expect(parks.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(parks);
    expect(props.onToggleCategory).toHaveBeenCalledWith('park');
  });

  it('liste les lieux, sans aucun bouton d’action sur les lignes', () => {
    setup();
    const list = screen.getByRole('group', { name: 'Lieux trouvés' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // Un seul bouton par ligne : le lieu lui-même (les actions passent par le menu contextuel).
    for (const item of items) expect(within(item).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Ajouter/ })).toBeNull();
  });

  it('clic droit sur un lieu : menu contextuel au pointeur', async () => {
    const props = setup();
    const item = screen.getByRole('button', { name: /^Café Kitsuné/ });
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 80,
    });
    item.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(props.onContextMenu).toHaveBeenCalledWith(POIS[2], { x: 120, y: 80 });
  });

  it('clic droit dans le détail déplié (lien Wikipédia) : menu du navigateur, pas celui du lieu', async () => {
    const props = setup({ selectedId: 'osm:N1000' });
    const link = await screen.findByRole('link', { name: 'Lire sur Wikipédia' });
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(props.onContextMenu).not.toHaveBeenCalled();
  });

  it('touche Maj+F10 sur un lieu : menu contextuel', async () => {
    const props = setup();
    await fireEvent.keyDown(screen.getByRole('button', { name: /^Café Kitsuné/ }), {
      key: 'F10',
      shiftKey: true,
    });
    expect(props.onContextMenu).toHaveBeenCalledWith(POIS[2], expect.objectContaining({}));
  });

  it('marque un lieu déjà présent dans le voyage', () => {
    setup();
    const louvre = screen.getByRole('listitem', { name: 'Musée du Louvre' });
    expect(within(louvre).getByText('Déjà ajouté')).toBeTruthy();
    expect(within(louvre).getAllByRole('button')).toHaveLength(1);
  });

  it('invite à zoomer quand la carte est trop éloignée', () => {
    setup({ zoomTooLow: true, pois: [] });
    expect(screen.getByText('Zoomez pour explorer')).toBeTruthy();
  });

  it('propose de relancer la recherche quand la carte a bougé', async () => {
    const props = setup({ stale: true });
    await fireEvent.click(screen.getByRole('button', { name: 'Rechercher dans cette zone' }));
    expect(props.onSearch).toHaveBeenCalled();
  });

  it('affiche le détail d’un lieu sélectionné, avec son résumé Wikipédia chargé à la demande', async () => {
    const props = setup({ selectedId: 'osm:N1000' });
    expect(props.loadWiki).toHaveBeenCalledWith('Q19675');
    expect(await screen.findByText('Le plus grand musée d’art du monde.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Musée du Louvre' })).toBeTruthy();
  });

  it('sélectionne un lieu au clic, et revient au jour', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: /^Musée des Arts décoratifs/ }));
    expect(props.onSelect).toHaveBeenCalledWith(POIS[0]);
    await fireEvent.click(screen.getByRole('button', { name: 'Retour au jour' }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('affiche l’erreur de recherche', () => {
    setup({ status: 'error', error: 'La découverte de lieux est indisponible.', pois: [] });
    expect(screen.getByRole('alert').textContent).toContain('indisponible');
  });

  it('« Tous » coche toutes les catégories d’un coup', async () => {
    const props = setup();
    const chips = within(screen.getByRole('group', { name: 'Catégories' }));
    const all = chips.getByRole('button', { name: 'Tous' });
    expect(all.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(all);
    expect(props.onSetCategories).toHaveBeenCalledWith([...POI_CATEGORIES]);
  });

  it('« Tous » quand tout est coché : décoche tout', async () => {
    const props = setup({ categories: [...POI_CATEGORIES] });
    const all = screen.getByRole('button', { name: 'Tous' });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(all);
    expect(props.onSetCategories).toHaveBeenCalledWith([]);
  });

  it('résultats groupés par catégorie : titre avec icône et nombre, dans l’ordre des catégories', () => {
    setup();
    const list = screen.getByRole('group', { name: 'Lieux trouvés' });
    const titles = within(list).getAllByRole('heading', { level: 3 });
    expect(titles.map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Cafés 1 lieu',
      'Musées 2 lieux',
    ]);
    // Une liste par catégorie, nommée par son titre (pas de titre directement dans une liste).
    expect(within(list).getByRole('list', { name: /Musées/ }).children).toHaveLength(2);
    expect(within(list).getByRole('list', { name: /Cafés/ }).children).toHaveLength(1);
    for (const title of titles) expect(title.parentElement?.tagName).not.toBe('UL');
    expect(titles.every((t) => t.querySelector('svg'))).toBe(true);
    // Les lieux restent les seuls éléments de la liste.
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    // Café Kitsuné (catégorie Cafés) vient avant les musées.
    const names = within(list)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.name')?.textContent);
    expect(names[0]).toBe('Café Kitsuné');
  });
});
