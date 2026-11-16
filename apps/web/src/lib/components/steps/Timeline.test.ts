import { dayTimeline } from '@mytrips/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeStay, makeStep } from '#lib/test/fixtures.ts';
import Timeline from './Timeline.svelte';

function setup(items: ReturnType<typeof dayTimeline>, overrides: Record<string, unknown> = {}) {
  const props = {
    items,
    labels: new Map<string, string>(),
    canEdit: true,
    highlighted: null,
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onHover: vi.fn(),
    onDrop: vi.fn(),
    ...overrides,
  };
  render(Timeline, { props });
  return props;
}

describe('Timeline', () => {
  it('affiche un état vide', () => {
    setup([]);
    expect(screen.getByText('Aucune étape pour ce jour.')).toBeTruthy();
  });

  it('encadre le jour avec le séjour : départ le matin, retour le soir', () => {
    const items = dayTimeline('2026-07-11', [makeStep({ dayId: 'd2' })], [makeStay()]);
    setup(items);
    expect(screen.getByText('Départ · 10:00')).toBeTruthy();
    expect(screen.getByText('Retour · 17:00')).toBeTruthy();
    expect(screen.getAllByText('Chalet de Cotagne')).toHaveLength(2);
  });

  it('affiche un check-in le jour d’arrivée', () => {
    setup(dayTimeline('2026-07-10', [], [makeStay()]));
    expect(screen.getByText('Check-in · 17:00')).toBeTruthy();
  });

  it('affiche les numéros de carte des étapes', () => {
    const items = dayTimeline('2026-07-10', [makeStep()], []);
    setup(items, { labels: new Map([['s1', '1']]) });
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('affiche un dossier comme une étape parente repliable', async () => {
    const g = makeStep({
      id: 'g',
      kind: 'group',
      type: null,
      name: 'Vieux-Port',
      lat: null,
      lng: null,
    });
    const c1 = makeStep({ id: 'c1', parentId: 'g', name: 'Notre-Dame', position: 'a1' });
    const c2 = makeStep({ id: 'c2', parentId: 'g', name: 'Restaurant du port', position: 'a2' });
    setup(dayTimeline('2026-07-10', [g, c1, c2], []));
    expect(screen.getByText('Vieux-Port')).toBeTruthy();
    expect(screen.getByText('2 étapes')).toBeTruthy();
    expect(screen.getByText('Notre-Dame')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Replier Vieux-Port' }));
    expect(screen.queryByText('Notre-Dame')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Déplier Vieux-Port' }));
    expect(screen.getByText('Notre-Dame')).toBeTruthy();
  });
});
