import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ShareDialog from './ShareDialog.svelte';

const members = [
  { email: 'bob@example.test', role: 'editor' as const },
  { email: 'carol@example.test', role: 'viewer' as const },
];

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    members,
    onInvite: vi.fn().mockResolvedValue('https://mytrips.test/invitation/abc'),
    onRoleChange: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(ShareDialog, { props });
  return props;
}

describe('ShareDialog', () => {
  it('liste les membres avec leur rôle', () => {
    setup();
    expect(screen.getByRole('dialog', { name: /partager/i })).toBeTruthy();
    expect(screen.getByText('bob@example.test')).toBeTruthy();
    const bob = screen.getByLabelText('Rôle de bob@example.test') as HTMLSelectElement;
    expect(bob.value).toBe('editor');
    const carol = screen.getByLabelText('Rôle de carol@example.test') as HTMLSelectElement;
    expect(carol.value).toBe('viewer');
  });

  it('ne parle plus de Cloudflare Access ni d’ajout par e-mail', () => {
    setup();
    expect(screen.queryByText(/cloudflare access/i)).toBeNull();
    expect(screen.queryByLabelText('E-mail')).toBeNull();
  });

  it('crée un lien d’invitation pour le rôle choisi et l’affiche', async () => {
    const props = setup();
    await fireEvent.change(screen.getByLabelText('Rôle de l’invité'), {
      target: { value: 'editor' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Créer un lien' }));
    expect(props.onInvite).toHaveBeenCalledWith('editor');
    const link = (await screen.findByLabelText('Lien d’invitation')) as HTMLInputElement;
    expect(link.value).toBe('https://mytrips.test/invitation/abc');
    expect(screen.getByText(/usage unique/i)).toBeTruthy();
  });

  it('copie le lien dans le presse-papiers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Créer un lien' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Copier' }));
    expect(writeText).toHaveBeenCalledWith('https://mytrips.test/invitation/abc');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copié' })).toBeTruthy());
  });

  it('change le rôle d’un membre', async () => {
    const props = setup();
    await fireEvent.change(screen.getByLabelText('Rôle de carol@example.test'), {
      target: { value: 'editor' },
    });
    expect(props.onRoleChange).toHaveBeenCalledWith('carol@example.test', 'editor');
  });

  it('affiche l’erreur d’une création de lien', async () => {
    setup({ onInvite: vi.fn().mockRejectedValue(new Error('Hors ligne')) });
    await fireEvent.click(screen.getByRole('button', { name: 'Créer un lien' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/hors ligne/i);
  });

  it('retire un membre', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Retirer carol@example.test' }));
    expect(props.onRemove).toHaveBeenCalledWith('carol@example.test');
  });

  it('se ferme', async () => {
    const props = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
