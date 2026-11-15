import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import UpdatePrompt from './UpdatePrompt.svelte';

describe('UpdatePrompt', () => {
  it('ne s’affiche pas tant qu’aucune nouvelle version n’est prête', () => {
    render(UpdatePrompt, { props: { needRefresh: false, onReload: vi.fn(), onDismiss: vi.fn() } });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('propose de recharger quand une nouvelle version est prête', async () => {
    const onReload = vi.fn();
    render(UpdatePrompt, { props: { needRefresh: true, onReload, onDismiss: vi.fn() } });
    expect(screen.getByRole('status').textContent).toContain('Nouvelle version disponible');
    await fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('peut être ignoré', async () => {
    const onDismiss = vi.fn();
    render(UpdatePrompt, { props: { needRefresh: true, onReload: vi.fn(), onDismiss } });
    await fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
