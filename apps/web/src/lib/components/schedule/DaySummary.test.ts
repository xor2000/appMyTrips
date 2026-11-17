import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DaySummary from './DaySummary.svelte';

const summary = {
  onSiteMin: 300,
  travelMin: 60,
  freeMin: 30,
  overrunMin: 54,
  conflictCount: 1,
  lateMin: 20,
  missingLegs: 0,
};

describe('DaySummary', () => {
  it('bandeau des problèmes et bouton « Réorganiser »', async () => {
    const onReorganize = vi.fn();
    render(DaySummary, { props: { summary, canEdit: true, onReorganize } });
    expect(screen.getByRole('status').textContent).toContain(
      'Dépasse la journée de 54 min · 1 conflit',
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Réorganiser' }));
    expect(onReorganize).toHaveBeenCalled();
  });

  it('barre de répartition : sur place, trajets, libre, dépassement', () => {
    render(DaySummary, { props: { summary, canEdit: true, onReorganize: vi.fn() } });
    const bar = screen.getByRole('img', {
      name: /Sur place 5 h · Trajets 1 h · Libre 30 min · Dépassement 54 min/,
    });
    expect(bar).toBeTruthy();
  });

  it('légende chiffrée sous la barre', () => {
    render(DaySummary, { props: { summary, canEdit: true, onReorganize: vi.fn() } });
    const legend = screen.getByTestId('day-legend');
    expect(legend.textContent).toContain('sur place 5 h');
    expect(legend.textContent).toContain('trajets 1 h');
    expect(legend.textContent).toContain('libre 30 min');
    expect(legend.textContent).toContain('dépassement 54 min');
  });

  it('sans problème : pas de bandeau ; en lecture seule, pas de bouton', () => {
    render(DaySummary, {
      props: {
        summary: { ...summary, overrunMin: 0, conflictCount: 0, lateMin: 0 },
        canEdit: false,
        onReorganize: vi.fn(),
      },
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réorganiser' })).toBeNull();
  });

  it('trajets manquants signalés', () => {
    render(DaySummary, {
      props: { summary: { ...summary, missingLegs: 2 }, canEdit: true, onReorganize: vi.fn() },
    });
    expect(screen.getByRole('status').textContent).toContain('2 trajets manquants');
  });
});
