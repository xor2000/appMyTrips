import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AppHeader from './AppHeader.svelte';

describe('AppHeader', () => {
  it('affiche le logo seul, comme lien vers l’accueil', () => {
    render(AppHeader);
    const link = screen.getByRole('link', { name: 'MyTrips, accueil' });
    expect(link.getAttribute('href')).toBe('/');
    // Le nom de l'application n'est plus écrit à côté du logo.
    expect(screen.queryByText('MyTrips')).toBeNull();
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

  it('affiche le contenu de la page entre le logo et le profil', () => {
    const content = createRawSnippet(() => ({ render: () => '<h1>Nouvel an 2026</h1>' }));
    render(AppHeader, {
      props: { me: { email: 'alice@example.test', isAdmin: false }, content },
    });
    expect(screen.getByRole('heading', { name: 'Nouvel an 2026' })).toBeTruthy();
  });
});
