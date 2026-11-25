import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeStep } from '#lib/test/fixtures.ts';
import IdeasPanel from './IdeasPanel.svelte';

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    ideas: [
      makeStep({ id: 'i1', dayId: null, name: 'Château d’Annecy' }),
      makeStep({ id: 'i2', dayId: null, name: 'Le Freti', type: 'restaurant', position: 'a2' }),
    ],
    canEdit: true,
    highlighted: null,
    onAddGroup: vi.fn(),
    onEdit: vi.fn(),
    onContextMenu: vi.fn(),
    onDrop: vi.fn(),
    ...overrides,
  };
  render(IdeasPanel, { props });
  return props;
}

/** Idées avec un dossier « À trier » qui contient le Semnoz. */
const withFolder = () => [
  makeStep({ id: 'i1', dayId: null, name: 'Château d’Annecy', position: 'a1' }),
  makeStep({
    id: 'g1',
    dayId: null,
    kind: 'group',
    type: null,
    name: 'À trier',
    lat: null,
    lng: null,
    position: 'a2',
  }),
  makeStep({ id: 'i3', dayId: null, parentId: 'g1', name: 'Semnoz', position: 'a1' }),
];

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

  it('dossiers d’idées : le dossier et ses idées, rangées dedans', () => {
    setup({ ideas: withFolder() });
    const folder = screen.getByTestId('group-card');
    expect(within(folder).getByText('À trier')).toBeTruthy();
    expect(within(folder).getByText('Semnoz')).toBeTruthy();
    // Le Semnoz n'apparaît qu'une fois (pas aussi à la racine).
    expect(screen.getAllByText('Semnoz')).toHaveLength(1);
    expect(screen.getByLabelText('Déposer dans À trier')).toBeTruthy();
    expect(screen.getByLabelText('Déposer à la fin de À trier')).toBeTruthy();
    // Compact : cartes et dossier en variante dense.
    expect(folder.classList.contains('dense')).toBe(true);
    expect(screen.getAllByTestId('step-card').every((c) => c.classList.contains('dense'))).toBe(
      true,
    );
  });

  it('plus de bouton « Ajouter une idée » ; un bouton icône « Nouveau dossier d’idées »', async () => {
    const props = setup();
    expect(screen.queryByRole('button', { name: 'Ajouter une idée' })).toBeNull();
    const add = screen.getByRole('button', { name: 'Nouveau dossier d’idées' });
    expect(add.textContent?.trim()).toBe('');
    await fireEvent.click(add);
    expect(props.onAddGroup).toHaveBeenCalled();
  });

  it('en lecture seule, pas de bouton « Nouveau dossier d’idées »', () => {
    setup({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Nouveau dossier d’idées' })).toBeNull();
  });
});
