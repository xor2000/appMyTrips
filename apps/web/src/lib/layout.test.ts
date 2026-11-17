import { describe, expect, it } from 'vitest';
import { LAYOUT_KEY, LAYOUTS, readLayout, saveLayout } from './layout';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const blocked = {
  getItem: () => {
    throw new Error('bloqué');
  },
  setItem: () => {
    throw new Error('bloqué');
  },
  removeItem: () => {
    throw new Error('bloqué');
  },
};

describe('affichage de la journée', () => {
  it('propose la liste (actuel), la ligne de métro et le plein écran', () => {
    expect(LAYOUTS.map((l) => l.id)).toEqual(['list', 'metro', 'board']);
  });

  it('lit l’affichage mémorisé ; « list » par défaut, si inconnu ou si le stockage est bloqué', () => {
    expect(readLayout(memoryStorage({ [LAYOUT_KEY]: 'metro' }))).toBe('metro');
    expect(readLayout(memoryStorage())).toBe('list');
    expect(readLayout(memoryStorage({ [LAYOUT_KEY]: 'kanban' }))).toBe('list');
    expect(readLayout(blocked)).toBe('list');
  });

  it('mémorise le choix, sans erreur si le stockage est bloqué', () => {
    const storage = memoryStorage();
    saveLayout('board', storage);
    expect(storage.getItem(LAYOUT_KEY)).toBe('board');
    expect(() => saveLayout('metro', blocked)).not.toThrow();
  });
});
