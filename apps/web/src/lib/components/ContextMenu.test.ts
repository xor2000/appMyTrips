import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import MapPin from 'lucide-svelte/icons/map-pin';
import Pencil from 'lucide-svelte/icons/pencil';
import Trash2 from 'lucide-svelte/icons/trash-2';
import ContextMenu, { type MenuEntry } from './ContextMenu.svelte';

function setup() {
  const edit = vi.fn();
  const toIdeas = vi.fn();
  const toDay = vi.fn();
  const entries: MenuEntry[] = [
    { kind: 'action', label: 'Modifier', icon: Pencil, run: edit },
    { kind: 'action', label: 'Supprimer', icon: Trash2, run: vi.fn(), danger: true },
    {
      kind: 'submenu',
      label: 'Déplacer vers',
      icon: MapPin,
      items: [
        { label: 'Idées', hint: null, run: toIdeas },
        { label: 'J2', hint: 'sam. 11 juil.', run: toDay },
      ],
    },
    { kind: 'link', label: 'Voir dans Google Maps', icon: MapPin, href: 'https://example.test/' },
  ];
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const onClose = vi.fn();
  render(ContextMenu, { props: { x: 40, y: 50, label: 'Musée du Louvre', entries, onClose } });
  return { edit, toIdeas, toDay, onClose, opener };
}

const menu = () => screen.getByRole('menu', { name: 'Musée du Louvre' });

describe('ContextMenu', () => {
  it('menu nommé, un élément par entrée avec son icône, focus sur le premier', async () => {
    setup();
    await tick();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent?.trim())).toEqual([
      'Modifier',
      'Supprimer',
      'Déplacer vers',
      'Voir dans Google Maps',
    ]);
    expect(items.every((i) => i.querySelector('svg'))).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it('placé au pointeur', () => {
    setup();
    expect(menu().style.left).toBe('40px');
    expect(menu().style.top).toBe('50px');
  });

  it('clic sur une action : l’exécute et ferme le menu', async () => {
    const { edit, onClose } = setup();
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Modifier' }));
    expect(edit).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('flèches : se déplace entre les éléments', async () => {
    setup();
    await tick();
    await fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('Supprimer');
    await fireEvent.keyDown(menu(), { key: 'End' });
    expect(document.activeElement?.textContent?.trim()).toBe('Voir dans Google Maps');
    await fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('Modifier');
  });

  it('sous-menu « Déplacer vers » : flèche droite l’ouvre, flèche gauche y revient', async () => {
    const { toDay, onClose } = setup();
    await tick();
    const parent = screen.getByRole('menuitem', { name: 'Déplacer vers' });
    expect(parent.getAttribute('aria-haspopup')).toBe('menu');
    expect(parent.getAttribute('aria-expanded')).toBe('false');
    parent.focus();
    await fireEvent.keyDown(parent, { key: 'ArrowRight' });
    await tick();
    const sub = screen.getByRole('menu', { name: 'Déplacer vers' });
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent).toContain('Idées');
    expect(sub.textContent).toContain('sam. 11 juil.');
    await fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    await tick();
    expect(screen.queryByRole('menu', { name: 'Déplacer vers' })).toBeNull();
    expect(document.activeElement).toBe(parent);

    await fireEvent.click(parent);
    await tick();
    await fireEvent.click(screen.getByRole('menuitem', { name: /J2/ }));
    expect(toDay).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('souris : le survol ouvre le sous-menu, le clic qui suit le laisse ouvert', async () => {
    setup();
    const parent = screen.getByRole('menuitem', { name: 'Déplacer vers' });
    await fireEvent.mouseEnter(parent.parentElement!);
    expect(screen.getByRole('menu', { name: 'Déplacer vers' })).toBeTruthy();
    await fireEvent.click(parent);
    await tick();
    expect(screen.getByRole('menu', { name: 'Déplacer vers' })).toBeTruthy();
  });

  it('lien : nouvel onglet, sans accès à la page d’origine', () => {
    setup();
    const link = screen.getByRole('menuitem', { name: 'Voir dans Google Maps' });
    expect(link.getAttribute('href')).toBe('https://example.test/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('Échap ferme le menu et rend le focus', async () => {
    const { onClose, opener } = setup();
    await tick();
    await fireEvent.keyDown(menu(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('un clic hors du menu le ferme', async () => {
    const { onClose } = setup();
    await fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});
