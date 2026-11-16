import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PasswordForm from './PasswordForm.svelte';

async function fill(label: string, value: string) {
  await fireEvent.input(screen.getByLabelText(label, { exact: true }), { target: { value } });
}

describe('PasswordForm', () => {
  it('changement : mot de passe actuel, nouveau et confirmation', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(PasswordForm, { props: { askCurrent: true, onSubmit, submitLabel: 'Changer' } });
    await fill('Mot de passe actuel', 'ancien');
    await fill('Nouveau mot de passe', 'nouveau-mot-1');
    await fill('Confirmer le nouveau mot de passe', 'nouveau-mot-1');
    await fireEvent.click(screen.getByRole('button', { name: 'Changer' }));
    expect(onSubmit).toHaveBeenCalledWith('nouveau-mot-1', 'ancien');
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('réinitialisation : pas de mot de passe actuel ; confirmation différente refusée', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(PasswordForm, { props: { onSubmit, submitLabel: 'Enregistrer' } });
    expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull();
    await fill('Nouveau mot de passe', 'nouveau-mot-1');
    await fill('Confirmer le nouveau mot de passe', 'autre-mot-de-passe');
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('alert').textContent).toMatch(/ne correspondent pas/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('affiche l’erreur renvoyée', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Mot de passe actuel incorrect.'));
    render(PasswordForm, { props: { askCurrent: true, onSubmit, submitLabel: 'Changer' } });
    await fill('Mot de passe actuel', 'faux');
    await fill('Nouveau mot de passe', 'nouveau-mot-1');
    await fill('Confirmer le nouveau mot de passe', 'nouveau-mot-1');
    await fireEvent.click(screen.getByRole('button', { name: 'Changer' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/incorrect/i);
  });
});
