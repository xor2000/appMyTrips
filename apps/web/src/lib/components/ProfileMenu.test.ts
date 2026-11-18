import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY } from '#lib/theme.ts';
import ProfileMenu from './ProfileMenu.svelte';

const signOut = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock('#lib/auth/signout.ts', () => ({ signOut }));

const alice = { email: 'alice@example.test', isAdmin: false };
const admin = { email: 'admin@example.test', isAdmin: true };

// Stockage en mémoire : le localStorage global de Node n'est pas celui de jsdom.
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  signOut.mockReset();
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

const button = () => screen.getByRole('button', { name: /Menu du compte/ });

async function open(me = alice) {
  render(ProfileMenu, { props: { me } });
  await fireEvent.click(button());
  return screen.getByRole('menu');
}

describe('ProfileMenu', () => {
  it('fermé par défaut ; le bouton porte l’e-mail du compte', () => {
    render(ProfileMenu, { props: { me: alice } });
    expect(button().getAttribute('aria-label')).toBe('Menu du compte (alice@example.test)');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('s’ouvre au clic et affiche l’e-mail', async () => {
    const menu = await open();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(menu.textContent).toContain('alice@example.test');
  });

  it('propose les quatre thèmes, le thème courant coché', async () => {
    store.set(THEME_KEY, 'pastel-dark');
    await open();
    const themes = screen.getAllByRole('menuitemradio');
    expect(themes.map((t) => t.textContent?.trim())).toEqual([
      'Automatique',
      'Pastel ludique clair',
      'Pastel ludique sombre',
      'Carnet clair',
    ]);
    expect(
      screen
        .getByRole('menuitemradio', { name: 'Pastel ludique sombre' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('choisir un thème l’applique, le mémorise et ferme le menu', async () => {
    await open();
    await fireEvent.click(screen.getByRole('menuitemradio', { name: 'Carnet clair' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('carnet');
    expect(store.get(THEME_KEY)).toBe('carnet');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('« Paramètres » mène à la page du compte ; pas d’administration sans droit', async () => {
    await open();
    expect(screen.getByRole('menuitem', { name: 'Paramètres' }).getAttribute('href')).toBe(
      '/compte',
    );
    expect(screen.queryByRole('menuitem', { name: 'Administration' })).toBeNull();
  });

  it('administrateur : entrée « Administration »', async () => {
    await open(admin);
    expect(screen.getByRole('menuitem', { name: 'Administration' }).getAttribute('href')).toBe(
      '/admin',
    );
  });

  it('« Se déconnecter » appelle la déconnexion', async () => {
    signOut.mockResolvedValue();
    await open();
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('déconnexion en échec : message affiché, menu ouvert', async () => {
    signOut.mockRejectedValue(new Error('Réseau indisponible'));
    await open();
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }));
    await tick();
    await tick();
    expect(screen.getByRole('alert').textContent).toContain('Réseau indisponible');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('Échap ferme le menu et rend le focus au bouton', async () => {
    const menu = await open();
    await fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('un clic en dehors ferme le menu', async () => {
    await open();
    await fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('les flèches parcourent les entrées, en boucle', async () => {
    const menu = await open();
    const items = [...menu.querySelectorAll('[role^="menuitem"]')];
    expect(items).toHaveLength(6);
    expect(document.activeElement).toBe(items[0]);
    await fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    await fireEvent.keyDown(menu, { key: 'ArrowUp' });
    await fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items.at(-1));
  });
});
