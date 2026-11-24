import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeStep } from '#lib/test/fixtures.ts';
import GroupCard from './GroupCard.svelte';

const group = (overrides = {}) =>
  makeStep({
    id: 'g1',
    kind: 'group',
    type: null,
    name: 'Vieux-Port',
    lat: null,
    lng: null,
    ...overrides,
  });

function setup(overrides: Record<string, unknown> = {}, groupOverrides = {}) {
  const props = {
    item: {
      kind: 'group' as const,
      key: 'g1',
      group: group(groupOverrides),
      children: [makeStep({ id: 'c1', parentId: 'g1', name: 'MuCEM' })],
    },
    labels: new Map<string, string>(),
    canEdit: true,
    highlighted: null,
    onEdit: vi.fn(),
    onContextMenu: vi.fn(),
    onHover: vi.fn(),
    onDropInto: vi.fn(),
    ...overrides,
  };
  render(GroupCard, { props });
  return props;
}

const card = () => screen.getByTestId('group-card');

describe('GroupCard', () => {
  it('couleur et icône choisies du dossier', () => {
    setup({}, { icon: 'park', color: 3 });
    expect(card().getAttribute('data-icon')).toBe('park');
    expect(card().getAttribute('style')).toContain('--gc: var(--leg-4)');
  });

  it('sans choix : icône dossier, couleur d’accent', () => {
    setup();
    expect(card().getAttribute('data-icon')).toBe('folder');
    expect(card().getAttribute('style')).toContain('--gc: var(--accent)');
  });

  it('clic sur le titre : replie puis déplie, sans ouvrir l’éditeur', async () => {
    const props = setup();
    expect(screen.getByText('MuCEM')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /^Vieux-Port/ }));
    expect(screen.queryByText('MuCEM')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /^Vieux-Port/ }));
    expect(screen.getByText('MuCEM')).toBeTruthy();
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('variante compacte (idées)', () => {
    setup({ dense: true });
    expect(card().classList.contains('dense')).toBe(true);
  });
});
