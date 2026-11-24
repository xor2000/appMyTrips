import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCALE_KEY, SCALES, applyScale, initialScale, scale, setScale } from './scale.svelte.ts';

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
  document.documentElement.style.removeProperty('--zoom');
  vi.unstubAllGlobals();
});

describe('taille d’affichage (comme appMyBank)', () => {
  it('trois tailles : 80, 90 et 100 %', () => {
    expect(SCALES).toEqual([80, 90, 100]);
  });

  it('100 % par défaut, ou valeur inconnue', () => {
    expect(initialScale()).toBe(100);
    store.set(SCALE_KEY, '75');
    expect(initialScale()).toBe(100);
  });

  it('relit la taille enregistrée', () => {
    store.set(SCALE_KEY, '80');
    expect(initialScale()).toBe(80);
  });

  it('stockage indisponible : 100 %', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqué');
      },
    });
    expect(initialScale()).toBe(100);
  });

  it('applyScale pose --zoom sur <html>', () => {
    applyScale(90);
    expect(document.documentElement.style.getPropertyValue('--zoom')).toBe('0.9');
  });

  it('setScale : taille partagée, appliquée et gardée dans le navigateur', () => {
    setScale(80);
    expect(scale.value).toBe(80);
    expect(document.documentElement.style.getPropertyValue('--zoom')).toBe('0.8');
    expect(store.get(SCALE_KEY)).toBe('80');
  });
});
