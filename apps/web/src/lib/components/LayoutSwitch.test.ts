import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LayoutSwitch from './LayoutSwitch.svelte';

describe('LayoutSwitch', () => {
  it('deux boutons, l’affichage actuel enfoncé ; un clic signale le nouveau', async () => {
    const onChange = vi.fn();
    render(LayoutSwitch, { props: { value: 'list', onChange } });
    expect(screen.getByRole('group', { name: 'Affichage' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Liste et carte' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Plein écran' }));
    expect(onChange).toHaveBeenCalledWith('board');
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Ligne de métro' })).toBeNull();
  });
});
