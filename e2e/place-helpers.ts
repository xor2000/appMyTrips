import { expect, type Page } from '@playwright/test';

/**
 * Ajoute un lieu par le bouton « Lieu » de la carte : recherche (services factices), puis la
 * fenêtre « Nouveau lieu » complétée et validée. Par défaut, dans le jour affiché ; `day` choisit
 * un autre jour (1 pour J1) ou les idées.
 */
export async function addPlaceViaMap(
  page: Page,
  query: string,
  result: string | RegExp,
  options: { day?: number | 'idées' } = {},
) {
  await page.getByRole('button', { name: 'Lieu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill(query);
  await dialog
    .getByRole('button', { name: typeof result === 'string' ? new RegExp(result) : result })
    .click();
  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  if (options.day === 'idées') {
    await form.getByLabel(/^Jour/).selectOption({ label: 'Idées (pas encore placé)' });
  } else if (options.day !== undefined) {
    await form.getByLabel(/^Jour/).selectOption({ index: options.day - 1 });
  }
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(form).toHaveCount(0);
}
