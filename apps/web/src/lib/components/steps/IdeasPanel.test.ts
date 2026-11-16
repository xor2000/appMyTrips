import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeStep } from '#lib/test/fixtures.ts';
import IdeasPanel from './IdeasPanel.svelte';

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    ideas: [
      makeStep({ id: 'i1', dayId: null, name: 'Château d’Annecy' }),
      makeStep({ id: 'i2', dayId: null, name: 'Le Freti', type: 'restaurant' }),
    ],
    canEdit: true,
    highlighted: null,
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onHover: vi.fn(),
    onDrop: vi.fn(),
    ...overrides,
  };
  render(IdeasPanel, { props });
  return props;
}

describe('IdeasPanel', () => {
  it('liste les idées pas encore placées', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Idées' })).toBeTruthy();
    expect(screen.getByText('Château d’Annecy')).toBeTruthy();
    expect(screen.getByText('Le Freti')).toBeTruthy();
  });

  it('affiche un état vide qui explique son rôle', () => {
    setup({ ideas: [] });
    expect(screen.getByText(/aucune idée/i)).toBeTruthy();
  });

  it('propose d’ajouter une idée', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Ajouter une idée' }));
    expect(props.onAdd).toHaveBeenCalled();
  });

  it('en lecture seule, ne propose pas d’ajout', () => {
    setup({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Ajouter une idée' })).toBeNull();
  });
});
