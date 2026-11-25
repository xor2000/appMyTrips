import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Illustration from './Illustration.svelte';

describe('Illustration', () => {
  it('affiche le pictogramme avec le libellé de l’illustration', () => {
    const { container } = render(Illustration, { id: 'van', variant: 'picto' });
    const img = screen.getByRole('img', { name: 'Van' });
    expect(img.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-illustration="van"]')).not.toBeNull();
  });

  it('affiche la scène, chargée à part', async () => {
    render(Illustration, { id: 'plage', variant: 'scene' });
    const img = screen.getByRole('img', { name: 'Plage' });
    // Premier import du module des scènes : sa transformation par Vite peut prendre une seconde.
    await waitFor(
      () => expect(img.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 160 100'),
      { timeout: 5000 },
    );
  });

  it('un échec de chargement des scènes n’est pas gardé : le suivant réessaie', async () => {
    vi.resetModules();
    vi.doMock('./scenes.ts', () => {
      throw new Error('chunk absent');
    });
    const { loadScenes } = await import('./Illustration.svelte');
    await expect(loadScenes()).rejects.toThrow();
    vi.doUnmock('./scenes.ts');
    await expect(loadScenes()).resolves.toHaveProperty('plage');
  });

  it('décorative : masquée aux lecteurs d’écran', () => {
    const { container } = render(Illustration, { id: 'van', variant: 'picto', decorative: true });
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });
});
