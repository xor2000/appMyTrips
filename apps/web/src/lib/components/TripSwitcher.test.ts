import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { makeTripSummary } from '#lib/test/fixtures.ts';
import TripSwitcher from './TripSwitcher.svelte';

const today = '2026-11-17';
const trips = [
  makeTripSummary({ id: 'p', name: 'Lisbonne', startDate: '2026-03-01', endDate: '2026-03-05' }),
  makeTripSummary({
    id: 'f',
    name: 'Alpes',
    startDate: '2027-02-20',
    endDate: '2027-02-24',
    illustration: 'van',
  }),
  makeTripSummary({ id: 'c', name: 'Marseille', startDate: '2026-11-15', endDate: '2026-11-18' }),
];

const combobox = () => screen.getByRole('combobox', { name: 'Choisir un voyage' });
const listbox = () => screen.getByRole('listbox', { name: 'Voyages' });
const optionNames = (group: HTMLElement) =>
  within(group)
    .getAllByRole('option')
    .map((o) => o.getAttribute('aria-label'));

function setup(props: Partial<Parameters<typeof render<typeof TripSwitcher>>[1]> = {}) {
  const onSelect = vi.fn();
  const result = render(TripSwitcher, {
    props: { trips, currentId: 'f', today, onSelect, ...props },
  });
  return { onSelect, ...result };
}

describe('TripSwitcher', () => {
  it('montre le voyage ouvert avec le pictogramme de son illustration, liste fermée', () => {
    setup();
    const box = combobox();
    expect(box.textContent).toContain('Alpes');
    expect(box.getAttribute('aria-expanded')).toBe('false');
    // L'illustration choisie (van) passe avant la suggestion tirée du nom (montagne).
    expect(box.querySelector('[data-illustration="van"] svg')).not.toBeNull();
    expect(box.querySelector('img')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('sans illustration choisie : celle suggérée par le nom du voyage', () => {
    setup({ currentId: 'p' });
    expect(combobox().querySelector('[data-illustration="ville"]')).not.toBeNull();
  });

  it('sans illustration ni suggestion : initiale du voyage', () => {
    setup({ currentId: 'c' });
    const box = combobox();
    expect(box.querySelector('[data-illustration]')).toBeNull();
    expect(box.querySelector('.thumb')?.textContent?.trim()).toBe('M');
  });

  it('ouverte : voyages à venir puis souvenirs, avec vignettes, dates et voyage coché', async () => {
    setup();
    await fireEvent.click(combobox());
    expect(combobox().getAttribute('aria-expanded')).toBe('true');
    const upcoming = within(listbox()).getByRole('group', { name: 'En cours et à venir' });
    expect(optionNames(upcoming)).toEqual(['Marseille', 'Alpes']);
    const past = within(listbox()).getByRole('group', { name: 'Souvenirs' });
    expect(optionNames(past)).toEqual(['Lisbonne']);

    const alpes = screen.getByRole('option', { name: 'Alpes' });
    expect(alpes.getAttribute('aria-selected')).toBe('true');
    expect(alpes.querySelector('[data-illustration="van"]')).not.toBeNull();
    expect(alpes.textContent).toContain('20 – 24 février 2027');
    expect(screen.getByRole('option', { name: 'Marseille' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('à l’ouverture, le voyage coché est amené en vue (longue liste)', async () => {
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.getAttribute('aria-label') ?? '');
    };
    try {
      setup();
      await fireEvent.click(combobox());
      await vi.waitFor(() => expect(scrolled).toEqual(['Alpes']));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('cliquer un autre voyage l’ouvre et ferme la liste', async () => {
    const { onSelect } = setup();
    await fireEvent.click(combobox());
    await fireEvent.click(screen.getByRole('option', { name: 'Lisbonne' }));
    expect(onSelect).toHaveBeenCalledWith('p');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('cliquer le voyage déjà ouvert ne fait que fermer', async () => {
    const { onSelect } = setup();
    await fireEvent.click(combobox());
    await fireEvent.click(screen.getByRole('option', { name: 'Alpes' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clavier : flèches pour parcourir, Entrée pour choisir, focus gardé sur la liste', async () => {
    const { onSelect } = setup();
    const box = combobox();
    box.focus();
    await fireEvent.keyDown(box, { key: 'ArrowDown' });
    // Ouverte sur le voyage courant.
    const active = () => document.getElementById(box.getAttribute('aria-activedescendant') ?? '');
    expect(active()?.getAttribute('aria-label')).toBe('Alpes');
    await fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(active()?.getAttribute('aria-label')).toBe('Lisbonne');
    await fireEvent.keyDown(box, { key: 'ArrowDown' });
    // Bouclage en fin de liste.
    expect(active()?.getAttribute('aria-label')).toBe('Marseille');
    await fireEvent.keyDown(box, { key: 'End' });
    expect(active()?.getAttribute('aria-label')).toBe('Lisbonne');
    await fireEvent.keyDown(box, { key: 'Home' });
    expect(active()?.getAttribute('aria-label')).toBe('Marseille');
    await fireEvent.keyDown(box, { key: 'ArrowUp' });
    expect(active()?.getAttribute('aria-label')).toBe('Lisbonne');
    await fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('p');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(box);
  });

  it('Échap ferme sans changer de voyage ; un clic en dehors aussi', async () => {
    const { onSelect } = setup();
    await fireEvent.keyDown(combobox(), { key: 'ArrowDown' });
    await fireEvent.keyDown(combobox(), { key: 'ArrowDown' });
    await fireEvent.keyDown(combobox(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    await fireEvent.click(combobox());
    expect(screen.getByRole('listbox')).toBeTruthy();
    await fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hors d’un voyage (Mon compte) : invite à choisir, aucun voyage coché', async () => {
    setup({ currentId: null });
    expect(combobox().textContent).toContain('Choisir un voyage…');
    await fireEvent.click(combobox());
    expect(
      screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toEqual([]);
  });

  it('roue crantée et « + » seulement quand l’action est possible', async () => {
    const onSettings = vi.fn();
    const onCreate = vi.fn();
    const { unmount } = setup({ onSettings, onCreate });
    await fireEvent.click(screen.getByRole('button', { name: 'Paramètres du voyage' }));
    expect(onSettings).toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Nouveau voyage' }));
    expect(onCreate).toHaveBeenCalled();
    unmount();

    // Lecteur ou hors ligne : ni paramètres ni création.
    setup();
    expect(screen.queryByRole('button', { name: 'Paramètres du voyage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nouveau voyage' })).toBeNull();
  });

  it('aucun voyage : pas de liste, seulement « + »', () => {
    setup({ trips: [], currentId: null, onCreate: vi.fn() });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nouveau voyage' })).toBeTruthy();
  });
});
