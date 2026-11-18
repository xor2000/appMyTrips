import { afterEach, describe, expect, it } from 'vitest';
import html from '../app.html?raw';
import { applyTheme, readTheme, saveTheme, THEME_EVENT, THEME_KEY, THEMES } from './theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const failing = {
  getItem: () => {
    throw new Error('stockage bloqué');
  },
  setItem: () => {
    throw new Error('stockage bloqué');
  },
  removeItem: () => {
    throw new Error('stockage bloqué');
  },
};

afterEach(() => document.documentElement.removeAttribute('data-theme'));

describe('thème', () => {
  it('propose Automatique, Pastel clair, Pastel sombre et Carnet clair', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['auto', 'pastel-light', 'pastel-dark', 'carnet']);
  });

  it('lit le thème mémorisé, « auto » par défaut ou si la valeur est inconnue', () => {
    expect(readTheme(memoryStorage({ [THEME_KEY]: 'carnet' }))).toBe('carnet');
    expect(readTheme(memoryStorage())).toBe('auto');
    expect(readTheme(memoryStorage({ [THEME_KEY]: 'violet' }))).toBe('auto');
    expect(readTheme(failing)).toBe('auto');
  });

  it('pose data-theme sur <html>, et le retire en automatique', () => {
    applyTheme('carnet');
    expect(document.documentElement.getAttribute('data-theme')).toBe('carnet');
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('mémorise et applique le choix ; « auto » efface la préférence', () => {
    const storage = memoryStorage();
    saveTheme('pastel-dark', storage);
    expect(storage.getItem(THEME_KEY)).toBe('pastel-dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('pastel-dark');
    saveTheme('auto', storage);
    expect(storage.getItem(THEME_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('annonce le changement de thème (sélecteur du compte et menu du profil)', () => {
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener(THEME_EVENT, listener);
    saveTheme('carnet', memoryStorage());
    window.removeEventListener(THEME_EVENT, listener);
    expect(seen).toEqual(['carnet']);
  });

  it('applique le choix même si le stockage est bloqué', () => {
    saveTheme('carnet', failing);
    expect(document.documentElement.getAttribute('data-theme')).toBe('carnet');
  });

  it('app.html applique le thème mémorisé avant le premier affichage', () => {
    expect(html).toContain(THEME_KEY);
    for (const t of THEMES.filter((t) => t.id !== 'auto')) expect(html).toContain(`'${t.id}'`);
  });
});
