import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AppHeader from './AppHeader.svelte';

describe('AppHeader', () => {
  it('affiche le nom de l’application comme lien vers l’accueil', () => {
    render(AppHeader);
    const link = screen.getByRole('link', { name: /mytrips/i });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('affiche l’e-mail de l’utilisateur connecté quand il est connu', () => {
    render(AppHeader, { props: { userEmail: 'alice@example.test' } });
    expect(screen.getByText('alice@example.test')).toBeTruthy();
  });

  it('n’affiche aucun e-mail quand l’utilisateur est inconnu', () => {
    render(AppHeader);
    expect(screen.queryByTestId('user-email')).toBeNull();
  });
});
