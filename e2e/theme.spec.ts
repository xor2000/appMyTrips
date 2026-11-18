import { expect, test } from '@playwright/test';
import { accountButton } from './auth-helpers';

test('choisir le thème « Carnet clair » sur Mon compte, le retrouver après rechargement', async ({
  page,
}) => {
  await page.goto('/compte');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme');

  await page.getByRole('radio', { name: /Carnet clair/ }).check();
  await expect(html).toHaveAttribute('data-theme', 'carnet');
  // Les couleurs viennent du fichier du thème (fond de page plus gris que Pastel ludique).
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe('rgb(244, 246, 246)');

  // Appliqué avant le premier affichage, y compris sur une autre page.
  await page.goto('/');
  await expect(html).toHaveAttribute('data-theme', 'carnet');

  await page.goto('/compte');
  await page.getByRole('radio', { name: /Automatique/ }).check();
  await page.reload();
  await expect(html).not.toHaveAttribute('data-theme');
});

test('choisir le thème depuis le menu du profil', async ({ page }) => {
  await page.goto('/compte');
  const html = page.locator('html');
  const menu = page.getByRole('menu');

  await accountButton(page).click();
  await menu.getByRole('menuitemradio', { name: 'Carnet clair' }).click();
  await expect(html).toHaveAttribute('data-theme', 'carnet');
  await expect(menu).toHaveCount(0);
  // Le sélecteur de la page du compte suit le choix fait dans le menu.
  await expect(page.getByRole('radio', { name: /Carnet clair/ })).toBeChecked();

  await accountButton(page).click();
  await expect(menu.getByRole('menuitemradio', { name: 'Carnet clair' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await menu.getByRole('menuitemradio', { name: 'Automatique' }).click();
  await page.reload();
  await expect(html).not.toHaveAttribute('data-theme');
});
