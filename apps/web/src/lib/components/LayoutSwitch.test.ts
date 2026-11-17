import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LayoutSwitch from './LayoutSwitch.svelte';

describe('LayoutSwitch', () => {
  it('trois boutons, l’affichage actuel enfoncé ; un clic signale le nouveau', async () => {
    const onChange = vi.fn();
    render(LayoutSwitch, { props: { value: 'list', onChange } });
    expect(screen.getByRole('group', { name: 'Affichage' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Liste et carte' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Ligne de métro' }));
    expect(onChange).toHaveBeenCalledWith('metro');
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeTruthy();
  });
});
