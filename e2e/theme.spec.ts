import { expect, test } from '@playwright/test';

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
