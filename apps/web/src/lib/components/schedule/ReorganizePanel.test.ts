import type { Fix } from '@mytrips/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ReorganizePanel from './ReorganizePanel.svelte';

const fixes: Fix[] = [
  {
    id: 'shorten-0',
    rule: 'shorten',
    label: 'Raccourcir : MuCEM 2 h → 1 h 40',
    effect: 'conflit résolu',
    ops: [{ kind: 'step', id: 's1', patch: { durationMin: 100 } }],
    gain: 20,
  },
  {
    id: 'advance-start-1',
    rule: 'advance-start',
    label: 'Commencer la journée à 07:40 (au lieu de 08:00)',
    effect: 'conflit résolu',
    ops: [{ kind: 'day', id: 'd1', patch: { dayStart: '07:40' } }],
    gain: 20,
  },
];

describe('ReorganizePanel', () => {
  it('liste les propositions et applique celle choisie', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(ReorganizePanel, { props: { fixes, onApply, onClose: vi.fn() } });
    expect(screen.getByRole('dialog', { name: 'Réorganiser la journée' })).toBeTruthy();
    expect(screen.getByText('Raccourcir : MuCEM 2 h → 1 h 40')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: /^Appliquer/ });
    expect(buttons).toHaveLength(2);
    await fireEvent.click(buttons[1]!);
    expect(onApply).toHaveBeenCalledWith(fixes[1]);
  });

  it('aucune proposition : message', () => {
    render(ReorganizePanel, { props: { fixes: [], onApply: vi.fn(), onClose: vi.fn() } });
    expect(screen.getByText(/Aucune proposition/)).toBeTruthy();
  });
});
