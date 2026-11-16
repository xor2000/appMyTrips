import { z } from 'zod';
import { Email } from '../common';

/** Mot de passe choisi : 10 à 128 caractères. */
export const Password = z
  .string()
  .min(10, 'Au moins 10 caractères')
  .max(128, '128 caractères au plus');

/** Réponse au captcha fait maison : jeton signé et résultat du calcul. */
export const CaptchaAnswer = z.object({
  token: z.string().min(1).max(1000),
  answer: z
    .string()
    .trim()
    .regex(/^-?\d{1,4}$/, 'Réponse numérique attendue'),
});

export const SignupInput = z.object({
  email: Email,
  password: Password,
  captcha: CaptchaAnswer,
});
export type SignupInput = z.infer<typeof SignupInput>;

/** Connexion : aucune règle de longueur, pour ne rien révéler des mots de passe acceptés. */
export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const PasswordChange = z.object({
  current: z.string().min(1).max(256),
  next: Password,
});

export const ResetInput = z.object({ password: Password });

/** Invitation à un voyage : rôle donné à la personne qui l'accepte. */
export const InvitationCreate = z.object({ role: z.enum(['viewer', 'editor']) });

/** Utilisateur connecté. */
export interface Me {
  email: string;
  isAdmin: boolean;
}

/** Administrateur : e-mail présent dans la liste `ADMIN_EMAILS` (séparateur : virgule). */
export function isAdminEmail(email: string, adminEmails: string | undefined): boolean {
  if (!adminEmails) return false;
  const wanted = email.trim().toLowerCase();
  return adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(wanted);
}
