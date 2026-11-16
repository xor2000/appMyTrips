import type { TripSummary } from '@mytrips/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TripCard from './TripCard.svelte';

const trip: TripSummary = {
  id: '3f0fa7bf-e95b-4fee-ab08-b30a6385734f',
  ownerEmail: 'alice@example.test',
  name: 'Voyage test Alpes',
  startDate: '2026-07-10',
  endDate: '2026-07-12',
  dayStart: '08:00',
  dayEnd: '22:00',
  defaultTimezone: 'Europe/Paris',
  hikeSpeedKmh: 3.5,
  version: 1,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  role: 'owner',
  dayCount: 3,
};

describe('TripCard', () => {
  it('affiche le nom, la période, le nombre de jours et le compte à rebours', () => {
    render(TripCard, { props: { trip, today: '2026-06-17', onDelete: vi.fn() } });
    expect(screen.getByRole('heading', { name: 'Voyage test Alpes' })).toBeTruthy();
    expect(screen.getByText('10 – 12 juillet 2026')).toBeTruthy();
    expect(screen.getByText('3 jours')).toBeTruthy();
    expect(screen.getByText('Dans 23 jours')).toBeTruthy();
  });

  it('ouvre le voyage par un lien', () => {
    render(TripCard, { props: { trip, today: '2026-06-17', onDelete: vi.fn() } });
    const link = screen.getByRole('link', { name: /ouvrir le carnet/i });
    expect(link.getAttribute('href')).toBe(`/trips/${trip.id}`);
  });

  it('permet au propriétaire de supprimer le voyage', async () => {
    const onDelete = vi.fn();
    render(TripCard, { props: { trip, today: '2026-06-17', onDelete } });
    await fireEvent.click(screen.getByRole('button', { name: /supprimer/i }));
    expect(onDelete).toHaveBeenCalledWith(trip);
    expect(screen.queryByText(/partagé/i)).toBeNull();
  });

  it('marque un voyage partagé et ne propose pas sa suppression', () => {
    render(TripCard, {
      props: { trip: { ...trip, role: 'viewer' }, today: '2026-06-17', onDelete: vi.fn() },
    });
    expect(screen.getByText('Partagé · lecture')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull();
  });

  it('écrit « 1 jour » au singulier', () => {
    render(TripCard, {
      props: { trip: { ...trip, dayCount: 1 }, today: '2026-06-17', onDelete: vi.fn() },
    });
    expect(screen.getByText('1 jour')).toBeTruthy();
  });

  it('signale un voyage disponible hors ligne', () => {
    render(TripCard, {
      props: { trip, today: '2026-06-17', onDelete: vi.fn(), offlineReady: true },
    });
    expect(screen.getByText('Disponible hors ligne')).toBeTruthy();
  });

  it('hors ligne (lecture seule) : pas de suppression', () => {
    render(TripCard, { props: { trip, today: '2026-06-17', onDelete: vi.fn(), readOnly: true } });
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull();
  });
});
