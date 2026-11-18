import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTheme, THEME_KEY } from '#lib/theme.ts';
import ThemePicker from './ThemePicker.svelte';

// Stockage en mémoire : le localStorage global de Node n'est pas celui de jsdom.
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe('ThemePicker', () => {
  it('propose les quatre thèmes, « Automatique » coché par défaut', () => {
    render(ThemePicker);
    const group = screen.getByRole('radiogroup', { name: 'Thème' });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect((screen.getByRole('radio', { name: /Automatique/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('applique et mémorise le thème choisi', async () => {
    render(ThemePicker);
    await fireEvent.click(screen.getByRole('radio', { name: /Carnet clair/ }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('carnet');
    expect(store.get(THEME_KEY)).toBe('carnet');
  });

  it('suit un thème choisi ailleurs (menu du profil)', async () => {
    render(ThemePicker);
    saveTheme('carnet');
    await tick();
    expect((screen.getByRole('radio', { name: /Carnet clair/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('reprend le thème déjà mémorisé', () => {
    store.set(THEME_KEY, 'pastel-dark');
    render(ThemePicker);
    expect(
      (screen.getByRole('radio', { name: /Pastel ludique sombre/ }) as HTMLInputElement).checked,
    ).toBe(true);
  });
});
