import type { TripSummary } from '@mytrips/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeCover, makeTripSummary } from '#lib/test/fixtures.ts';
import TripCard from './TripCard.svelte';

const trip: TripSummary = makeTripSummary();

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

  it('affiche la photo de couverture et son crédit, lien vers Commons', () => {
    const cover = makeCover();
    render(TripCard, {
      props: { trip: { ...trip, cover }, today: '2026-06-17', onDelete: vi.fn() },
    });
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe(cover.thumbUrl);
    const credit = screen.getByRole('link', { name: /Jean Dupont/ });
    expect(credit.getAttribute('href')).toBe(cover.sourceUrl);
    expect(credit.textContent).toContain('CC BY-SA 4.0');
  });

  it('sans photo : pas d’image, la teinte reste', () => {
    render(TripCard, { props: { trip, today: '2026-06-17', onDelete: vi.fn() } });
    expect(document.querySelector('img')).toBeNull();
  });

  it('affiche les chiffres et les principaux lieux', () => {
    render(TripCard, {
      props: {
        trip: { ...trip, stepCount: 4, distanceM: 1200, places: ['MuCEM', 'Vieux-Port'] },
        today: '2026-06-17',
        onDelete: vi.fn(),
      },
    });
    expect(screen.getByText('4 étapes')).toBeTruthy();
    expect(screen.getByText('1,2 km')).toBeTruthy();
    expect(screen.getByText('MuCEM')).toBeTruthy();
    expect(screen.getByText('Vieux-Port')).toBeTruthy();
  });

  it('voyage en cours : indique le jour du voyage', () => {
    render(TripCard, { props: { trip, today: '2026-07-11', onDelete: vi.fn() } });
    expect(screen.getByText('En cours · jour 2')).toBeTruthy();
  });

  it('photo qui ne charge plus : l’image est masquée, la teinte reprend', async () => {
    render(TripCard, {
      props: { trip: { ...trip, cover: makeCover() }, today: '2026-06-17', onDelete: vi.fn() },
    });
    const img = document.querySelector('img')!;
    await fireEvent.error(img);
    expect(img.hidden).toBe(true);
  });
});
