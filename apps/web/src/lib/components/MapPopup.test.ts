import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { MapPopupContent } from '#lib/map/popups.ts';
import MapPopup from './MapPopup.svelte';

function content(overrides: Partial<MapPopupContent> = {}): MapPopupContent {
  return {
    kind: 'step',
    category: 'Musée · J1',
    color: '--type-museum',
    title: 'Musée du Louvre',
    notes: 'Billet coupe-file',
    meta: [],
    chip: null,
    actions: [],
    ...overrides,
  };
}

describe('MapPopup', () => {
  it('comme la référence : catégorie, nom en titre, notes ; data-testid selon le type', () => {
    render(MapPopup, { props: { content: content() } });
    expect(screen.getByTestId('step-popup')).toBeTruthy();
    expect(screen.getByText('Musée · J1')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Musée du Louvre' })).toBeTruthy();
    expect(screen.getByText('Billet coupe-file')).toBeTruthy();
  });

  it('adresse sous le nom, avant les notes (comme la popup du clic droit)', () => {
    const { container } = render(MapPopup, {
      props: { content: content({ icon: 'museum', address: 'Rue de Rivoli, 75001 Paris' }) },
    });
    const address = screen.getByText('Rue de Rivoli, 75001 Paris');
    const notes = screen.getByText('Billet coupe-file');
    expect(address.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.type-icon svg')).toBeTruthy();
  });

  it('sans notes ni infos : ni paragraphe ni ligne d’infos', () => {
    const { container } = render(MapPopup, { props: { content: content({ notes: '' }) } });
    expect(container.querySelector('.notes')).toBeNull();
    expect(container.querySelector('.meta')).toBeNull();
  });

  it('infos séparées par « · » et pastille (cochée pour « Déjà ajouté »)', () => {
    const { container } = render(MapPopup, {
      props: {
        content: content({
          kind: 'leg',
          meta: ['12 km', '25 min'],
          chip: { label: 'estimé', check: false },
        }),
      },
    });
    expect(screen.getByTestId('leg-popup')).toBeTruthy();
    expect(container.querySelector('.meta')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '12 km · 25 min estimé',
    );
    render(MapPopup, {
      props: { content: content({ kind: 'poi', chip: { label: 'Déjà ajouté', check: true } }) },
    });
    const chip = screen.getByText('Déjà ajouté');
    expect(chip.closest('.chip')?.querySelector('svg')).toBeTruthy();
  });

  it('actions : boutons dans l’ordre, principal en bouton plein', async () => {
    const add = vi.fn();
    const ideas = vi.fn();
    render(MapPopup, {
      props: {
        content: content({
          actions: [
            { label: 'Ajouter à J2', icon: 'plus', primary: true, run: add },
            { label: 'Ajouter aux idées', icon: 'plus', run: ideas },
          ],
        }),
      },
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Ajouter à J2',
      'Ajouter aux idées',
    ]);
    expect(buttons[0]!.classList.contains('btn-primary')).toBe(true);
    expect(buttons[1]!.classList.contains('btn-ghost')).toBe(true);
    await fireEvent.click(buttons[1]!);
    expect(ideas).toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it('lieu découvert : icône du type à gauche du nom, source en petit sous l’adresse', () => {
    const { container } = render(MapPopup, {
      props: {
        content: content({
          kind: 'poi',
          category: 'Musée',
          icon: 'museum',
          source: 'Geoapify · OpenStreetMap',
          notes: '107 Rue de Rivoli, Paris',
        }),
      },
    });
    const heading = screen.getByRole('heading', { level: 4, name: 'Musée du Louvre' });
    expect(heading.querySelector('.type-icon svg')).toBeTruthy();
    expect(container.querySelector('.cat')?.textContent?.trim()).toBe('Musée');
    const source = container.querySelector('.source');
    expect(source?.textContent?.trim()).toBe('Geoapify · OpenStreetMap');
    // Sous l'adresse.
    expect(container.querySelector('.notes')?.nextElementSibling).toBe(source);
  });

  it('sans icône ni source (étape, trajet) : rien de plus', () => {
    const { container } = render(MapPopup, { props: { content: content() } });
    expect(container.querySelector('.type-icon')).toBeNull();
    expect(container.querySelector('.source')).toBeNull();
  });
});
