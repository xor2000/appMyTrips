import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TripFormDialog from './TripFormDialog.svelte';

async function fill(name: string, start: string, end: string) {
  await fireEvent.input(screen.getByLabelText('Nom du voyage'), { target: { value: name } });
  await fireEvent.input(screen.getByLabelText('Du'), { target: { value: start } });
  await fireEvent.input(screen.getByLabelText('Au'), { target: { value: end } });
}

describe('TripFormDialog', () => {
  it('crée un voyage avec le nom, la période et le fuseau du navigateur', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(TripFormDialog, { props: { onSubmit, onClose: vi.fn() } });
    expect(screen.getByRole('dialog', { name: 'Nouveau voyage' })).toBeTruthy();
    await fill('Alpes', '2026-07-10', '2026-07-12');
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le voyage' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Alpes',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it('refuse une fin avant le début', async () => {
    const onSubmit = vi.fn();
    render(TripFormDialog, { props: { onSubmit, onClose: vi.fn() } });
    await fill('Alpes', '2026-07-12', '2026-07-10');
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le voyage' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/fin/i);
  });

  it('pré-remplit le formulaire en modification et n’envoie pas le fuseau', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(TripFormDialog, {
      props: {
        initial: { name: 'Alpes', startDate: '2026-07-10', endDate: '2026-07-12' },
        onSubmit,
        onClose: vi.fn(),
      },
    });
    expect(screen.getByRole('dialog', { name: 'Modifier le voyage' })).toBeTruthy();
    expect((screen.getByLabelText('Nom du voyage') as HTMLInputElement).value).toBe('Alpes');
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Alpes',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
    });
  });

  it('affiche l’erreur renvoyée par onSubmit', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Serveur indisponible'));
    render(TripFormDialog, { props: { onSubmit, onClose: vi.fn() } });
    await fill('Alpes', '2026-07-10', '2026-07-12');
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le voyage' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Serveur indisponible');
  });
});
