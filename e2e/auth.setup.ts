import { expect, test as setup } from '@playwright/test';
import { DEV_EMAIL, DEV_STATE, loginViaUi, signupViaUi } from './auth-helpers';

// Connecte le compte principal des e2e et enregistre sa session : les autres tests la
// réutilisent (storageState du projet chromium).
setup('connexion du compte principal', async ({ page }) => {
  await page.goto('/connexion');
  await signupViaUi(page, DEV_EMAIL);
  // Base conservée (serveur réutilisé) : le compte existe déjà, on se connecte.
  const taken = page.getByText('Un compte existe déjà avec cet e-mail.');
  const header = page.getByTestId('user-email');
  await expect(taken.or(header)).toBeVisible();
  if (await taken.isVisible()) {
    await page.getByRole('tab', { name: 'Se connecter' }).click();
    await loginViaUi(page, DEV_EMAIL);
  }
  await expect(header).toHaveText(DEV_EMAIL);
  await page.context().storageState({ path: DEV_STATE });
});
