import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import BasemapPicker from './BasemapPicker.svelte';

const button = () => screen.getByRole('button', { name: 'Fond de carte' });

async function open(value: 'plan' | 'topo' | 'satellite' = 'plan') {
  const onSelect = vi.fn();
  render(BasemapPicker, { props: { value, onSelect } });
  await fireEvent.click(button());
  return { onSelect, menu: screen.getByRole('menu', { name: 'Choix du fond de carte' }) };
}

describe('BasemapPicker', () => {
  it('fermé par défaut : un bouton « Fond de carte » qui annonce un menu', () => {
    render(BasemapPicker, { props: { value: 'plan', onSelect: vi.fn() } });
    expect(button().getAttribute('aria-haspopup')).toBe('menu');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('s’ouvre au clic : Plan, Topo et Satellite, le fond courant coché et focalisé', async () => {
    await open('topo');
    expect(button().getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Plan', 'Topo', 'Satellite']);
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(document.activeElement).toBe(items[1]);
  });

  it('choisir un fond : onSelect, menu fermé, focus rendu au bouton', async () => {
    const { onSelect } = await open('plan');
    await fireEvent.click(screen.getByRole('menuitemradio', { name: 'Satellite' }));
    expect(onSelect).toHaveBeenCalledWith('satellite');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('choisir le fond courant ne fait que fermer le menu', async () => {
    const { onSelect } = await open('plan');
    await fireEvent.click(screen.getByRole('menuitemradio', { name: 'Plan' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('clavier : flèches pour parcourir, Échap pour fermer', async () => {
    const { menu } = await open('plan');
    const items = screen.getAllByRole('menuitemradio');
    await fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    await fireEvent.keyDown(menu, { key: 'ArrowUp' });
    await fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[2]);
    await fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('un clic hors du menu le ferme ; un second clic sur le bouton aussi', async () => {
    await open();
    await fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    await fireEvent.click(button());
    expect(screen.getByRole('menu')).toBeTruthy();
    await fireEvent.click(button());
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
