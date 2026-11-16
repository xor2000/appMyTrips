import { describe, expect, it } from 'vitest';
import {
  CaptchaAnswer,
  InvitationCreate,
  LoginInput,
  Password,
  PasswordChange,
  ResetInput,
  SignupInput,
  isAdminEmail,
} from './schemas';

const captcha = { token: 'jeton', answer: '12' };

describe('schémas d’authentification', () => {
  it('mot de passe : 10 à 128 caractères', () => {
    expect(Password.safeParse('court').success).toBe(false);
    expect(Password.safeParse('assez-long-1').success).toBe(true);
    expect(Password.safeParse('x'.repeat(129)).success).toBe(false);
  });

  it('inscription : e-mail normalisé, mot de passe et captcha obligatoires', () => {
    expect(
      SignupInput.parse({ email: '  Alice@Example.TEST ', password: 'assez-long-1', captcha }),
    ).toEqual({ email: 'alice@example.test', password: 'assez-long-1', captcha });
    expect(
      SignupInput.safeParse({ email: 'alice@example.test', password: 'assez-long-1' }).success,
    ).toBe(false);
    expect(
      SignupInput.safeParse({ email: 'pas-un-email', password: 'assez-long-1', captcha }).success,
    ).toBe(false);
  });

  it('connexion : e-mail et mot de passe non vide (pas de règle de longueur, pour ne rien révéler)', () => {
    expect(LoginInput.parse({ email: 'Bob@Example.test', password: 'x' })).toEqual({
      email: 'bob@example.test',
      password: 'x',
    });
    expect(LoginInput.safeParse({ email: 'bob@example.test', password: '' }).success).toBe(false);
  });

  it('changement et réinitialisation : le nouveau mot de passe suit la règle', () => {
    expect(PasswordChange.safeParse({ current: 'ancien', next: 'nouveau-mot-1' }).success).toBe(
      true,
    );
    expect(PasswordChange.safeParse({ current: 'ancien', next: 'court' }).success).toBe(false);
    expect(ResetInput.safeParse({ password: 'nouveau-mot-1' }).success).toBe(true);
  });

  it('captcha : réponse numérique', () => {
    expect(CaptchaAnswer.safeParse(captcha).success).toBe(true);
    expect(CaptchaAnswer.safeParse({ token: 'jeton', answer: 'douze' }).success).toBe(false);
  });

  it('invitation : rôle lecture ou modification', () => {
    expect(InvitationCreate.parse({ role: 'viewer' })).toEqual({ role: 'viewer' });
    expect(InvitationCreate.safeParse({ role: 'owner' }).success).toBe(false);
  });

  it('administrateurs : liste d’e-mails séparés par des virgules, sans casse', () => {
    expect(isAdminEmail('Admin@Example.test', 'admin@example.test, autre@example.test')).toBe(true);
    expect(isAdminEmail('alice@example.test', 'admin@example.test')).toBe(false);
    expect(isAdminEmail('alice@example.test', undefined)).toBe(false);
  });
});
