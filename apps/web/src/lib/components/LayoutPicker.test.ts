import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LayoutPicker from './LayoutPicker.svelte';

describe('LayoutPicker', () => {
  it('propose les trois affichages, le choix actuel coché', () => {
    render(LayoutPicker, { props: { value: 'metro', onChange: vi.fn() } });
    expect(screen.getByRole('radiogroup', { name: 'Affichage de la journée' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(
      (screen.getByRole('radio', { name: /Ligne de métro/ }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('signale le nouveau choix', async () => {
    const onChange = vi.fn();
    render(LayoutPicker, { props: { value: 'list', onChange } });
    await fireEvent.click(screen.getByRole('radio', { name: /Plein écran/ }));
    expect(onChange).toHaveBeenCalledWith('board');
  });
});
