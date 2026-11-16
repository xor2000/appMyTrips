import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AppHeader from './AppHeader.svelte';

describe('AppHeader', () => {
  it('affiche le nom de l’application comme lien vers l’accueil', () => {
    render(AppHeader);
    const link = screen.getByRole('link', { name: /mytrips/i });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('connecté : l’e-mail mène à la page du compte', () => {
    render(AppHeader, { props: { me: { email: 'alice@example.test', isAdmin: false } } });
    const account = screen.getByRole('link', { name: /alice@example.test/ });
    expect(account.getAttribute('href')).toBe('/compte');
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  });

  it('administrateur : lien vers l’administration', () => {
    render(AppHeader, { props: { me: { email: 'admin@example.test', isAdmin: true } } });
    expect(screen.getByRole('link', { name: 'Administration' }).getAttribute('href')).toBe(
      '/admin',
    );
  });

  it('n’affiche aucun compte quand l’utilisateur est inconnu', () => {
    render(AppHeader);
    expect(screen.queryByTestId('user-email')).toBeNull();
  });
});
