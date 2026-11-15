import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ShareDialog from './ShareDialog.svelte';

const members = [
  { email: 'bob@example.test', role: 'editor' as const },
  { email: 'carol@example.test', role: 'viewer' as const },
];

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    members,
    onAdd: vi.fn().mockResolvedValue(undefined),
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
    expect(screen.getByText('Modification')).toBeTruthy();
    expect(screen.getByText('Lecture seule')).toBeTruthy();
  });

  it('rappelle que l’invité doit aussi être autorisé dans Cloudflare Access', () => {
    setup();
    expect(screen.getByText(/cloudflare access/i)).toBeTruthy();
  });

  it('ajoute un membre avec un e-mail normalisé et le rôle choisi', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('E-mail'), {
      target: { value: '  Dave@Example.TEST ' },
    });
    await fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'editor' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Inviter' }));
    expect(props.onAdd).toHaveBeenCalledWith('dave@example.test', 'editor');
  });

  it('refuse un e-mail invalide sans appeler onAdd', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('E-mail'), { target: { value: 'dave' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Inviter' }));
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/e-mail invalide/i);
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
