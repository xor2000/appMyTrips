import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import AdminPanel from './AdminPanel.svelte';

const bans = [
  {
    ip: '2001:db8::1',
    bannedAt: '2026-11-16T10:00:00.000Z',
    lastEmail: 'a@example.test',
    failures: 3,
  },
];

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    loadBans: vi.fn().mockResolvedValue(bans),
    onUnban: vi.fn().mockResolvedValue(undefined),
    onCreateReset: vi.fn().mockResolvedValue('https://mytrips.test/reinitialisation/r'),
    ...overrides,
  };
  render(AdminPanel, { props });
  return props;
}

describe('AdminPanel', () => {
  it('liste les IP bannies avec l’e-mail tenté et les échecs, et les réactive', async () => {
    const props = setup();
    const row = (await screen.findByText('2001:db8::1')).closest('tr')!;
    expect(within(row).getByText('a@example.test')).toBeTruthy();
    expect(within(row).getByText('3')).toBeTruthy();
    await fireEvent.click(within(row).getByRole('button', { name: 'Réactiver 2001:db8::1' }));
    expect(props.onUnban).toHaveBeenCalledWith('2001:db8::1');
    await waitFor(() => expect(props.loadBans).toHaveBeenCalledTimes(2));
  });

  it('aucune IP bannie : message', async () => {
    setup({ loadBans: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByText(/aucune adresse bannie/i)).toBeTruthy();
  });

  it('génère un lien de réinitialisation pour un e-mail', async () => {
    const props = setup();
    await fireEvent.input(screen.getByLabelText('E-mail du compte'), {
      target: { value: 'Bob@Example.test' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Générer le lien' }));
    expect(props.onCreateReset).toHaveBeenCalledWith('bob@example.test');
    const link = (await screen.findByLabelText('Lien de réinitialisation')) as HTMLInputElement;
    expect(link.value).toBe('https://mytrips.test/reinitialisation/r');
  });

  it('affiche l’erreur (compte inconnu)', async () => {
    setup({
      onCreateReset: vi.fn().mockRejectedValue(new Error('Aucun compte avec cet e-mail.')),
    });
    await fireEvent.input(screen.getByLabelText('E-mail du compte'), {
      target: { value: 'x@example.test' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Générer le lien' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/aucun compte/i);
  });
});
