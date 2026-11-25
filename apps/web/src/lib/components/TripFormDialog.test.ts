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

  it('modification : illustration suggérée par le nom tant qu’aucune n’est choisie', () => {
    render(TripFormDialog, {
      props: {
        initial: { name: 'Randonnée GR20', startDate: '2026-07-10', endDate: '2026-07-12' },
        illustration: null,
        onSubmit: vi.fn(),
        onClose: vi.fn(),
      },
    });
    const section = screen.getByRole('region', { name: 'Illustration du voyage' });
    expect(section.querySelector('[data-illustration="randonnee"]')).not.toBeNull();
    expect(section.textContent).toContain('Automatique : Randonnée');
  });

  it('modification : choisir une illustration l’envoie avec le voyage', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(TripFormDialog, {
      props: {
        initial: { name: 'Voyage test Alpes', startDate: '2026-07-10', endDate: '2026-07-12' },
        illustration: null,
        onSubmit,
        onClose: vi.fn(),
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Changer l’illustration' }));
    const group = screen.getByRole('group', { name: 'Illustration' });
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(25);
    await fireEvent.click(screen.getByRole('radio', { name: 'Van' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Voyage test Alpes',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      illustration: 'van',
    });
  });

  it('modification : « Automatique » retire l’illustration choisie', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(TripFormDialog, {
      props: {
        initial: { name: 'Alpes', startDate: '2026-07-10', endDate: '2026-07-12' },
        illustration: 'van',
        onSubmit,
        onClose: vi.fn(),
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Changer l’illustration' }));
    expect((screen.getByRole('radio', { name: 'Van' }) as HTMLInputElement).checked).toBe(true);
    await fireEvent.click(screen.getByRole('radio', { name: 'Automatique' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ illustration: null });
  });

  it('modification sans changer l’illustration : elle n’est pas envoyée', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(TripFormDialog, {
      props: {
        initial: { name: 'Alpes', startDate: '2026-07-10', endDate: '2026-07-12' },
        illustration: 'van',
        onSubmit,
        onClose: vi.fn(),
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('illustration');
  });

  it('création : pas de choix d’illustration', () => {
    render(TripFormDialog, { props: { onSubmit: vi.fn(), onClose: vi.fn() } });
    expect(screen.queryByRole('region', { name: 'Illustration du voyage' })).toBeNull();
  });

  it('paramètres : « Supprimer le voyage » seulement quand la suppression est permise', async () => {
    const onDelete = vi.fn();
    const initial = { name: 'Alpes', startDate: '2026-07-10', endDate: '2026-07-12' };
    const { unmount } = render(TripFormDialog, {
      props: { initial, onSubmit: vi.fn(), onClose: vi.fn(), onDelete },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Supprimer le voyage' }));
    expect(onDelete).toHaveBeenCalled();
    unmount();

    render(TripFormDialog, { props: { initial, onSubmit: vi.fn(), onClose: vi.fn() } });
    expect(screen.queryByRole('button', { name: 'Supprimer le voyage' })).toBeNull();
  });
});
