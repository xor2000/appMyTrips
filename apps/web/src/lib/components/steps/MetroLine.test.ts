import { dayTimeline, type ScheduledItem } from '@mytrips/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeStay, makeStep } from '#lib/test/fixtures.ts';
import MetroLine from './MetroLine.svelte';

const time = (key: string, start: string, end: string, extra: Partial<ScheduledItem> = {}) =>
  ({
    key,
    kind: 'step',
    start: { time: start, dayOffset: 0 },
    end: { time: end, dayOffset: 0 },
    timezone: 'Europe/Paris',
    freeBeforeMin: 0,
    issues: [],
    ...extra,
  }) as ScheduledItem;

function setup(overrides: Record<string, unknown> = {}) {
  const items = dayTimeline(
    '2026-07-10',
    [
      makeStep({ id: 'a', name: 'MuCEM', position: 'a0' }),
      makeStep({ id: 'g', kind: 'group', type: null, name: 'Vieux-Port', position: 'a1' }),
      makeStep({ id: 'c1', parentId: 'g', name: 'Notre-Dame', position: 'a0', type: 'monument' }),
      makeStep({ id: 'c2', parentId: 'g', name: 'Restaurant', position: 'a1', type: 'restaurant' }),
      makeStep({ id: 'b', name: 'Vol', position: 'a2', type: 'airport' }),
    ],
    [],
  );
  const props = {
    items,
    labels: new Map([
      ['a', '1'],
      ['c1', '2'],
      ['c2', '3'],
      ['b', '4'],
    ]),
    canEdit: true,
    highlighted: null,
    onEdit: vi.fn(),
    onEditStay: vi.fn(),
    onContextMenu: vi.fn(),
    onHover: vi.fn(),
    onDrop: vi.fn(),
    after: createRawSnippet((key: () => string) => ({
      render: () => `<div data-testid="after-${key()}"></div>`,
    })),
    times: new Map([
      ['a', time('a', '08:35', '10:35')],
      [
        'b',
        time('b', '14:50', '16:00', {
          freeBeforeMin: 75,
          issues: [{ kind: 'conflict', lateMin: 20 }],
        }),
      ],
    ]),
    ...overrides,
  };
  render(MetroLine, { props });
  return props;
}

describe('MetroLine', () => {
  it('une station par étape, dans l’ordre, avec l’heure de début en avant', () => {
    setup();
    const stops = screen.getAllByTestId('metro-stop');
    expect(stops.map((s) => s.querySelector('.name')?.textContent)).toEqual([
      'MuCEM',
      'Notre-Dame',
      'Restaurant',
      'Vol',
    ]);
    expect(stops[0]!.querySelector('.start')?.textContent).toBe('08:35');
    expect(stops[0]!.textContent).toContain('08:35 → 10:35');
  });

  it('un dossier encadre ses étapes ; le trajet qui le suit est dehors', () => {
    setup();
    const group = screen.getByTestId('metro-group');
    expect(group.textContent).toContain('Vieux-Port');
    expect(group.contains(screen.getByTestId('after-c1'))).toBe(true);
    expect(group.contains(screen.getByTestId('after-c2'))).toBe(false);
    expect(screen.getByTestId('after-a')).toBeTruthy();
  });

  it('signale le temps libre et le conflit', () => {
    setup();
    expect(screen.getByText('1 h 15 de temps libre')).toBeTruthy();
    const vol = screen.getAllByTestId('metro-stop')[3]!;
    expect(vol.classList.contains('conflict')).toBe(true);
    expect(vol.textContent).toContain('Conflit +20 min');
  });

  it('clic : ouvre l’étape ; clic droit : menu contextuel ; plus de flèches ni de corbeille', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: /^MuCEM/ }));
    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    await fireEvent.contextMenu(screen.getAllByTestId('metro-stop')[3]!, {
      clientX: 10,
      clientY: 20,
    });
    expect(props.onContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), {
      x: 10,
      y: 20,
    });
    // L'en-tête d'un dossier ouvre aussi le menu (pour le dossier).
    await fireEvent.contextMenu(screen.getByTestId('metro-group').querySelector('.group-head')!);
    expect(props.onContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'group' }),
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: /Plus tôt|Plus tard|Supprimer/ })).toBeNull();
  });

  it('zones de dépôt entre les stations et dans le dossier ; aucune en lecture seule', () => {
    setup();
    expect(screen.getAllByTestId('drop-zone').length).toBeGreaterThanOrEqual(6);
  });

  it('lecture seule : ni zones de dépôt ni actions, stations non déplaçables', () => {
    setup({ canEdit: false });
    expect(screen.queryAllByTestId('drop-zone')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Plus tard|Supprimer/ })).toBeNull();
    expect(screen.getAllByTestId('metro-stop')[0]!.getAttribute('draggable')).toBe('false');
  });

  it('séjour : station « H » ouvrable', async () => {
    const onEditStay = vi.fn();
    const items = dayTimeline('2026-07-11', [makeStep({ dayId: 'd2' })], [makeStay()]);
    setup({ items, onEditStay });
    const stays = screen.getAllByTestId('metro-stay');
    expect(stays).toHaveLength(2);
    await fireEvent.click(stays[0]!.querySelector('button')!);
    expect(onEditStay).toHaveBeenCalled();
  });

  it('jour vide : message et zone de dépôt', () => {
    setup({ items: [] });
    expect(screen.getByText('Aucune étape pour ce jour.')).toBeTruthy();
    expect(screen.getAllByTestId('drop-zone')).toHaveLength(1);
  });
});
