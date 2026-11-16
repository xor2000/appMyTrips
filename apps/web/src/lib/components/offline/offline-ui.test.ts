import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import InstallPrompt from './InstallPrompt.svelte';
import OfflineBanner from './OfflineBanner.svelte';
import OfflineDialog from './OfflineDialog.svelte';

describe('OfflineBanner', () => {
  it('indique le mode hors ligne et la date de la copie', () => {
    render(OfflineBanner, { props: { savedAt: '2026-07-12T07:14:00.000Z' } });
    // 07:14 UTC = 09:14 à Paris (fuseau des tests).
    expect(screen.getByRole('status').textContent).toMatch(
      /Hors ligne · consultation seule · données du 12\/07 à \d\d:14/,
    );
  });

  it('sans copie datée : simple mention hors ligne', () => {
    render(OfflineBanner, { props: { savedAt: null } });
    expect(screen.getByRole('status').textContent).toContain('Hors ligne · consultation seule');
  });
});

describe('OfflineDialog', () => {
  const base = {
    tileCount: 1200,
    reduced: false,
    prepared: null,
    usedBytes: null,
    progress: null,
    error: null,
    onPrepare: vi.fn(),
    onRelease: vi.fn(),
    onClose: vi.fn(),
  };

  it('estime puis lance la préparation', async () => {
    const onPrepare = vi.fn();
    render(OfflineDialog, { props: { ...base, onPrepare } });
    expect(screen.getByRole('dialog', { name: 'Préparer hors ligne' })).toBeTruthy();
    expect(screen.getByText(/1\s?200 tuiles · environ 30 Mo/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Préparer' }));
    expect(onPrepare).toHaveBeenCalled();
  });

  it('zone trop vaste : zoom réduit signalé', () => {
    render(OfflineDialog, { props: { ...base, reduced: true } });
    expect(screen.getByText(/zone est vaste/)).toBeTruthy();
  });

  it('progression', () => {
    render(OfflineDialog, { props: { ...base, progress: { done: 300, total: 1200 } } });
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('300');
    expect(bar.getAttribute('aria-valuemax')).toBe('1200');
  });

  it('déjà préparé : statut, espace utilisé et « Libérer »', async () => {
    const onRelease = vi.fn();
    render(OfflineDialog, {
      props: {
        ...base,
        prepared: { at: '2026-07-12T07:14:00.000Z', bytes: 30_000_000, tileUrls: [] },
        usedBytes: 52_000_000,
        onRelease,
      },
    });
    expect(screen.getByText(/Disponible hors ligne/)).toBeTruthy();
    expect(screen.getByText(/52 Mo utilisés/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Libérer' }));
    expect(onRelease).toHaveBeenCalled();
  });

  it('erreur affichée', () => {
    render(OfflineDialog, { props: { ...base, error: 'Espace de stockage insuffisant.' } });
    expect(screen.getByRole('alert').textContent).toContain('Espace de stockage insuffisant');
  });
});

describe('InstallPrompt', () => {
  it('propose l’installation quand le navigateur le permet', async () => {
    render(InstallPrompt);
    expect(screen.queryByRole('button', { name: 'Installer l’application' })).toBeNull();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
    const button = await screen.findByRole('button', { name: 'Installer l’application' });
    await fireEvent.click(button);
    expect(prompt).toHaveBeenCalled();
  });
});
