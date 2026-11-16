import { expect, test, type Browser } from '@playwright/test';
import {
  ADMIN_EMAIL,
  PASSWORD,
  anonymousContext,
  loginViaUi,
  newUser,
  signupViaUi,
} from './auth-helpers';

/** Contexte connecté avec le compte administrateur (créé au premier usage). */
async function adminPage(browser: Browser) {
  const context = await anonymousContext(browser);
  const page = await context.newPage();
  await page.goto('/connexion');
  await signupViaUi(page, ADMIN_EMAIL);
  const taken = page.getByText('Un compte existe déjà avec cet e-mail.');
  const header = page.getByTestId('user-email');
  await expect(taken.or(header)).toBeVisible();
  if (await taken.isVisible()) {
    await page.getByRole('tab', { name: 'Se connecter' }).click();
    await loginViaUi(page, ADMIN_EMAIL);
  }
  await expect(header).toHaveText(ADMIN_EMAIL);
  return { context, page };
}

test('sans session, une page renvoie vers la connexion puis y revient', async ({ browser }) => {
  const context = await anonymousContext(browser);
  const page = await context.newPage();
  await page.goto('/compte');
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fcompte$/);
  await signupViaUi(page, `retour-${Date.now()}@example.test`);
  await expect(page).toHaveURL(/\/compte$/);
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await context.close();
});

test('inscription avec captcha, déconnexion, puis connexion', async ({ browser }) => {
  const { context, page, email } = await newUser(browser, 'inscrit');
  await page.getByTestId('user-email').click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByTestId('user-email')).toHaveCount(0);

  // Mauvais mot de passe : message, pas de session.
  await loginViaUi(page, email, 'pas-le-bon-mot');
  await expect(page.getByRole('alert')).toContainText('E-mail ou mot de passe incorrect');
  await loginViaUi(page, email);
  await expect(page.getByTestId('user-email')).toHaveText(email);
  await expect(page.getByRole('heading', { name: 'Mes voyages' })).toBeVisible();
  await context.close();
});

test('3 mots de passe faux : adresse bloquée, puis réactivée par l’admin', async ({ browser }) => {
  const { context: userContext, page: userPage, email } = await newUser(browser, 'banni');
  await userPage.getByTestId('user-email').click();
  await userPage.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(userPage).toHaveURL(/\/connexion$/);
  for (let i = 0; i < 3; i++) {
    await loginViaUi(userPage, email, `faux-${i}`);
    await expect(userPage.getByRole('alert')).toBeVisible();
  }
  await loginViaUi(userPage, email);
  await expect(userPage.getByRole('alert')).toContainText('bloquée');

  const admin = await adminPage(browser);
  await admin.page.getByRole('link', { name: 'Administration' }).click();
  const row = admin.page.getByRole('row').filter({ hasText: email });
  await expect(row).toContainText('3');
  await row.getByRole('button', { name: /réactiver/i }).click();
  await expect(admin.page.getByRole('row').filter({ hasText: email })).toHaveCount(0);

  await loginViaUi(userPage, email);
  await expect(userPage.getByTestId('user-email')).toHaveText(email);
  await userContext.close();
  await admin.context.close();
});

test('mot de passe oublié : lien de réinitialisation généré par l’admin', async ({ browser }) => {
  const { context: userContext, email } = await newUser(browser, 'oubli');
  await userContext.close();

  const admin = await adminPage(browser);
  await admin.page.goto('/admin');
  await admin.page.getByLabel('E-mail du compte').fill(email);
  await admin.page.getByRole('button', { name: 'Générer le lien' }).click();
  const link = await admin.page.getByLabel('Lien de réinitialisation').inputValue();
  expect(link).toMatch(/\/reinitialisation\/[\w-]+$/);
  await admin.context.close();

  const context = await anonymousContext(browser);
  const page = await context.newPage();
  await page.goto(new URL(link).pathname);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('tout-nouveau-mot');
  await page
    .getByLabel('Confirmer le nouveau mot de passe', { exact: true })
    .fill('tout-nouveau-mot');
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await expect(page.getByRole('status')).toContainText('Mot de passe enregistré');
  await page.getByRole('link', { name: 'Se connecter' }).click();
  await loginViaUi(page, email, PASSWORD);
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await loginViaUi(page, email, 'tout-nouveau-mot');
  await expect(page.getByTestId('user-email')).toHaveText(email);
  await context.close();
});

test('changer de mot de passe depuis la page du compte', async ({ browser }) => {
  const { context, page, email } = await newUser(browser, 'change');
  await page.getByTestId('user-email').click();
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('encore-un-autre');
  await page
    .getByLabel('Confirmer le nouveau mot de passe', { exact: true })
    .fill('encore-un-autre');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await loginViaUi(page, email, 'encore-un-autre');
  await expect(page.getByTestId('user-email')).toHaveText(email);
  await context.close();
});
