import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drag } from '#lib/steps/dnd.svelte.ts';
import DayTabs from './DayTabs.svelte';

const days = [
  { id: 'd1', date: '2026-07-10', dayStart: null, dayEnd: null, notes: '' },
  { id: 'd2', date: '2026-07-11', dayStart: null, dayEnd: null, notes: '' },
  { id: 'd3', date: '2026-07-12', dayStart: null, dayEnd: null, notes: '' },
];

describe('DayTabs', () => {
  it('affiche « Tout le voyage » puis un onglet par jour', () => {
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Tout le voyage',
      'J1 ven. 10 juil.',
      'J2 sam. 11 juil.',
      'J3 dim. 12 juil.',
    ]);
  });

  it('pastille d’alerte sur un jour en conflit ou qui déborde', () => {
    render(DayTabs, {
      props: { days, selected: null, onSelect: vi.fn(), alerts: new Set(['d2']) },
    });
    expect(screen.getByRole('tab', { name: /J2.*à revoir/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /J1.*à revoir/ })).toBeNull();
  });

  it('marque l’onglet sélectionné', () => {
    render(DayTabs, { props: { days, selected: 'd2', onSelect: vi.fn() } });
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('J2');
  });

  it('sélectionne « Tout le voyage » quand aucun jour n’est choisi', () => {
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('Tout le voyage');
  });

  it('signale le jour choisi, ou null pour tout le voyage', async () => {
    const onSelect = vi.fn();
    render(DayTabs, { props: { days, selected: null, onSelect } });
    await fireEvent.click(screen.getByRole('tab', { name: /J3/ }));
    expect(onSelect).toHaveBeenLastCalledWith('d3');
    await fireEvent.click(screen.getByRole('tab', { name: 'Tout le voyage' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('la période du voyage s’affiche sous « Tout le voyage »', () => {
    render(DayTabs, {
      props: { days, selected: null, onSelect: vi.fn(), period: '10 – 12 juillet 2026' },
    });
    expect(screen.getByRole('tab', { name: /Tout le voyage/ }).textContent).toContain(
      '10 – 12 juillet 2026',
    );
  });
});

describe('DayTabs : défilement des jours', () => {
  // jsdom ne fait pas de mise en page : largeurs et position de défilement simulées.
  const box = { scrollWidth: 0, clientWidth: 300 };
  const scrollLeft = new WeakMap<Element, number>();
  const scrollBy = vi.fn(function (this: HTMLElement, options: ScrollToOptions) {
    scrollLeft.set(this, (scrollLeft.get(this) ?? 0) + (options.left ?? 0));
  });

  beforeEach(() => {
    box.scrollWidth = 0;
    scrollBy.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => box.scrollWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => box.clientWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get(this: HTMLElement) {
        return scrollLeft.get(this) ?? 0;
      },
      set(this: HTMLElement, v: number) {
        scrollLeft.set(this, v);
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });
  });

  afterEach(() => {
    for (const key of ['scrollWidth', 'clientWidth', 'scrollLeft', 'scrollBy']) {
      Reflect.deleteProperty(HTMLElement.prototype, key);
    }
    drag.stepId = null;
  });

  /** Conteneur défilant des onglets de jours. */
  const scroller = () => screen.getByRole('tab', { name: /J1/ }).parentElement as HTMLElement;

  it('aucune flèche quand tous les jours tiennent', () => {
    box.scrollWidth = 300;
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    expect(screen.queryByTitle('Jours précédents')).toBeNull();
    expect(screen.queryByTitle('Jours suivants')).toBeNull();
  });

  it('des flèches avant le premier jour et après le dernier quand ils débordent', async () => {
    box.scrollWidth = 1000;
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    const prev = await screen.findByTitle('Jours précédents');
    const next = screen.getByTitle('Jours suivants');
    // Ordre : « Tout le voyage », flèche précédente, jours, flèche suivante.
    const tabsAll = screen.getByRole('tab', { name: 'Tout le voyage' });
    expect(tabsAll.compareDocumentPosition(prev) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      prev.compareDocumentPosition(scroller()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      scroller().compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Au début : rien avant.
    expect((prev as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('les flèches font avancer et reculer dans les jours', async () => {
    box.scrollWidth = 1000;
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    await fireEvent.click(await screen.findByTitle('Jours suivants'));
    expect(scrollBy).toHaveBeenLastCalledWith(
      expect.objectContaining({ left: expect.any(Number) }),
    );
    const forward = scrollBy.mock.lastCall?.[0].left ?? 0;
    expect(forward).toBeGreaterThan(0);
    await fireEvent.scroll(scroller());
    const prev = screen.getByTitle('Jours précédents') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
    await fireEvent.click(prev);
    expect(scrollBy.mock.lastCall?.[0].left).toBeLessThan(0);
  });

  it('au dernier jour, la flèche suivante est désactivée', async () => {
    box.scrollWidth = 1000;
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    await screen.findByTitle('Jours suivants');
    scroller().scrollLeft = 700;
    await fireEvent.scroll(scroller());
    expect((screen.getByTitle('Jours suivants') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle('Jours précédents') as HTMLButtonElement).disabled).toBe(false);
  });

  it('la molette verticale fait défiler les jours horizontalement', async () => {
    box.scrollWidth = 1000;
    render(DayTabs, { props: { days, selected: null, onSelect: vi.fn() } });
    await screen.findByTitle('Jours suivants');
    await fireEvent.wheel(scroller(), { deltaY: 120 });
    expect(scroller().scrollLeft).toBe(120);
  });

  it('une étape glissée sur une flèche fait défiler les jours', async () => {
    box.scrollWidth = 1000;
    render(DayTabs, {
      props: { days, selected: null, onSelect: vi.fn(), onDropStep: vi.fn() },
    });
    drag.stepId = 's1';
    await fireEvent.dragOver(await screen.findByTitle('Jours suivants'));
    expect(scroller().scrollLeft).toBeGreaterThan(0);
  });
});
