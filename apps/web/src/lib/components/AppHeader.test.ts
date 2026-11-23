import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AppHeader from './AppHeader.svelte';

describe('AppHeader', () => {
  it('affiche le logo et le nom de l’application, comme lien vers l’accueil', () => {
    render(AppHeader);
    const link = screen.getByRole('link', { name: 'MyTrips, accueil' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toContain('MyTrips');
  });

  it('connecté : un bouton de profil remplace l’e-mail et le lien Administration', () => {
    render(AppHeader, { props: { me: { email: 'admin@example.test', isAdmin: true } } });
    expect(screen.getByRole('button', { name: /Menu du compte/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  });

  it('n’affiche aucun compte quand l’utilisateur est inconnu', () => {
    render(AppHeader);
    expect(screen.queryByRole('button', { name: /Menu du compte/ })).toBeNull();
  });

  it('affiche le choix du voyage puis le contenu de la page, avant le profil', () => {
    const trips = createRawSnippet(() => ({
      render: () => '<select aria-label="Voyages"></select>',
    }));
    const content = createRawSnippet(() => ({ render: () => '<div role="tablist"></div>' }));
    render(AppHeader, {
      props: { me: { email: 'alice@example.test', isAdmin: false }, trips, content },
    });
    const banner = screen.getByRole('banner');
    const order = [
      screen.getByRole('link', { name: 'MyTrips, accueil' }),
      screen.getByRole('combobox', { name: 'Voyages' }),
      screen.getByRole('tablist'),
      screen.getByRole('button', { name: /Menu du compte/ }),
    ];
    for (const el of order) expect(banner.contains(el)).toBe(true);
    for (let i = 1; i < order.length; i++) {
      // Chaque élément suit le précédent dans le document (une seule ligne, dans cet ordre).
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
