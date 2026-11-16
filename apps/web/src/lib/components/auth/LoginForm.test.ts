import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm.svelte';

const captcha = { question: 'Combien font 2 + 3 ?', token: 'jeton' };

function setup(overrides: Record<string, unknown> = {}) {
  const props = {
    onLogin: vi.fn().mockResolvedValue(undefined),
    onSignup: vi.fn().mockResolvedValue(undefined),
    loadCaptcha: vi.fn().mockResolvedValue(captcha),
    ...overrides,
  };
  render(LoginForm, { props });
  return props;
}

async function fill(label: string, value: string) {
  await fireEvent.input(screen.getByLabelText(label, { exact: true }), { target: { value } });
}

async function openSignup() {
  await fireEvent.click(screen.getByRole('tab', { name: 'Créer un compte' }));
  await screen.findByText('Combien font 2 + 3 ?');
}

describe('LoginForm', () => {
  it('connexion avec e-mail et mot de passe', async () => {
    const props = setup();
    await fill('E-mail', 'alice@example.test');
    await fill('Mot de passe', 'mot-de-passe-1');
    await fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(props.onLogin).toHaveBeenCalledWith('alice@example.test', 'mot-de-passe-1');
  });

  it('affiche l’erreur de connexion (IP bloquée…)', async () => {
    setup({ onLogin: vi.fn().mockRejectedValue(new Error('Adresse bloquée')) });
    await fill('E-mail', 'alice@example.test');
    await fill('Mot de passe', 'x');
    await fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/adresse bloquée/i);
  });

  it('inscription : question de calcul, confirmation du mot de passe', async () => {
    const props = setup();
    await openSignup();
    await fill('E-mail', 'bob@example.test');
    await fill('Mot de passe', 'mot-de-passe-1');
    await fill('Confirmer le mot de passe', 'mot-de-passe-1');
    await fill('Réponse', '5');
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    expect(props.onSignup).toHaveBeenCalledWith('bob@example.test', 'mot-de-passe-1', {
      token: 'jeton',
      answer: '5',
    });
  });

  it('inscription : mots de passe trop courts ou différents refusés sans appel', async () => {
    const props = setup();
    await openSignup();
    await fill('E-mail', 'bob@example.test');
    await fill('Mot de passe', 'court');
    await fill('Confirmer le mot de passe', 'court');
    await fill('Réponse', '5');
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    expect(screen.getByRole('alert').textContent).toMatch(/10 caractères/);
    await fill('Mot de passe', 'mot-de-passe-1');
    await fill('Confirmer le mot de passe', 'mot-de-passe-2');
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    expect(screen.getByRole('alert').textContent).toMatch(/ne correspondent pas/i);
    expect(props.onSignup).not.toHaveBeenCalled();
  });

  it('inscription refusée : nouvelle question (le captcha ne sert qu’une fois)', async () => {
    const loadCaptcha = vi
      .fn()
      .mockResolvedValueOnce(captcha)
      .mockResolvedValueOnce({ question: 'Combien font 4 + 4 ?', token: 'autre' });
    setup({ loadCaptcha, onSignup: vi.fn().mockRejectedValue(new Error('Réponse fausse')) });
    await openSignup();
    await fill('E-mail', 'bob@example.test');
    await fill('Mot de passe', 'mot-de-passe-1');
    await fill('Confirmer le mot de passe', 'mot-de-passe-1');
    await fill('Réponse', '9');
    await fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/réponse fausse/i);
    expect(await screen.findByText('Combien font 4 + 4 ?')).toBeTruthy();
  });
});
