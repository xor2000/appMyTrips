import { fireEvent, render, screen } from '@testing-library/svelte';
import { STEP_TYPES } from '@mytrips/core';
import { describe, expect, it, vi } from 'vitest';
import { makeStep } from '#lib/test/fixtures.ts';
import GroupDialog from './GroupDialog.svelte';

const checked = (name: string | RegExp) =>
  (screen.getByRole('radio', { name }) as HTMLInputElement).checked;

describe('GroupDialog', () => {
  it('création : nom, icône (Dossier par défaut puis les types), couleur (Automatique puis 8)', async () => {
    const onSave = vi.fn(async () => {});
    render(GroupDialog, { props: { onSave, onClose: vi.fn() } });
    expect(screen.getByRole('dialog', { name: 'Nouveau dossier' })).toBeTruthy();
    const icons = screen.getByRole('group', { name: 'Icône' });
    expect(icons.querySelectorAll('input[type="radio"]')).toHaveLength(1 + STEP_TYPES.length);
    expect(checked('Dossier')).toBe(true);
    const colors = screen.getByRole('group', { name: 'Couleur' });
    expect(colors.querySelectorAll('input[type="radio"]')).toHaveLength(9);
    expect(checked('Automatique')).toBe(true);

    await fireEvent.input(screen.getByLabelText('Nom du dossier'), {
      target: { value: '  Musées  ' },
    });
    await fireEvent.click(screen.getByRole('radio', { name: 'Musée' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'Rose' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le dossier' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Musées', icon: 'museum', color: 3 });
  });

  it('création : un nom est obligatoire', async () => {
    const onSave = vi.fn(async () => {});
    render(GroupDialog, { props: { onSave, onClose: vi.fn() } });
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le dossier' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('nom');
  });

  it('modification : valeurs du dossier, « Enregistrer »', async () => {
    const onSave = vi.fn(async () => {});
    const group = makeStep({
      kind: 'group',
      type: null,
      name: 'Vieux-Port',
      lat: null,
      lng: null,
      icon: 'park',
      color: 5,
    });
    render(GroupDialog, { props: { group, onSave, onClose: vi.fn() } });
    expect(screen.getByRole('dialog', { name: 'Modifier le dossier' })).toBeTruthy();
    expect((screen.getByLabelText('Nom du dossier') as HTMLInputElement).value).toBe('Vieux-Port');
    expect(checked('Parc')).toBe(true);
    expect(checked('Vert')).toBe(true);
    await fireEvent.click(screen.getByRole('radio', { name: 'Dossier' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'Automatique' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Vieux-Port', icon: null, color: null });
  });
});
