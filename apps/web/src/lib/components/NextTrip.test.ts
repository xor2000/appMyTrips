import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeCover, makeTripSummary } from '#lib/test/fixtures.ts';
import NextTrip from './NextTrip.svelte';

describe('NextTrip', () => {
  it('prochain départ : compte à rebours en grand, nom, période et lien', () => {
    const trip = makeTripSummary({ stepCount: 6, distanceM: 214_000, places: ['MuCEM'] });
    render(NextTrip, { props: { trip, today: '2026-06-28', onDelete: vi.fn() } });
    expect(screen.getByText('Prochain départ')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Voyage test Alpes' })).toBeTruthy();
    expect(screen.getByTestId('next-countdown').textContent?.trim()).toMatch(/12\s*jours/);
    expect(screen.getByText('10 – 12 juillet 2026')).toBeTruthy();
    expect(screen.getByText(/3 jours · 6 étapes · 214 km/)).toBeTruthy();
    const link = screen.getByRole('link', { name: /ouvrir le carnet/i });
    expect(link.getAttribute('href')).toBe(`/trips/${trip.id}`);
  });

  it('départ demain : « 1 jour »', () => {
    render(NextTrip, {
      props: { trip: makeTripSummary(), today: '2026-07-09', onDelete: vi.fn() },
    });
    expect(screen.getByTestId('next-countdown').textContent?.trim()).toMatch(/1\s*jour$/);
  });

  it('voyage en cours : « En cours » et le jour du voyage', () => {
    render(NextTrip, {
      props: { trip: makeTripSummary(), today: '2026-07-11', onDelete: vi.fn() },
    });
    expect(screen.getByText('En cours')).toBeTruthy();
    expect(screen.getByTestId('next-countdown').textContent?.trim()).toMatch(/J2\s*sur 3/);
  });

  it('photo en grand avec son crédit', () => {
    const cover = makeCover();
    render(NextTrip, {
      props: { trip: makeTripSummary({ cover }), today: '2026-06-28', onDelete: vi.fn() },
    });
    expect(document.querySelector('img')?.getAttribute('src')).toBe(cover.url);
    expect(screen.getByRole('link', { name: /Jean Dupont/ }).getAttribute('href')).toBe(
      cover.sourceUrl,
    );
  });

  it('le propriétaire peut supprimer le voyage ; pas un invité', async () => {
    const onDelete = vi.fn();
    const trip = makeTripSummary();
    const { unmount } = render(NextTrip, { props: { trip, today: '2026-06-28', onDelete } });
    await fireEvent.click(screen.getByRole('button', { name: /supprimer/i }));
    expect(onDelete).toHaveBeenCalledWith(trip);
    unmount();
    render(NextTrip, {
      props: { trip: { ...trip, role: 'editor' }, today: '2026-06-28', onDelete },
    });
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull();
    expect(screen.getByText('Partagé · modification')).toBeTruthy();
  });
});
