import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LayoutPicker from './LayoutPicker.svelte';

describe('LayoutPicker', () => {
  it('propose les deux affichages, le choix actuel coché', () => {
    render(LayoutPicker, { props: { value: 'board', onChange: vi.fn() } });
    expect(screen.getByRole('radiogroup', { name: 'Affichage de la journée' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect((screen.getByRole('radio', { name: /Plein écran/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.queryByRole('radio', { name: /Ligne de métro/ })).toBeNull();
  });

  it('signale le nouveau choix', async () => {
    const onChange = vi.fn();
    render(LayoutPicker, { props: { value: 'list', onChange } });
    await fireEvent.click(screen.getByRole('radio', { name: /Plein écran/ }));
    expect(onChange).toHaveBeenCalledWith('board');
  });
});
