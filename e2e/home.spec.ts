import { expect, test, type Page } from '@playwright/test';
import { newUser } from './auth-helpers';

/** Style de carte minimal : les e2e ne dépendent pas des serveurs de tuiles. */
const EMPTY_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#dfe9e4' } }],
};

test.beforeEach(async ({ context }) => {
  await context.route('https://tiles.openfreemap.org/**', (route) =>
    route.request().url().includes('/styles/')
      ? route.fulfill({ json: EMPTY_STYLE })
      : route.abort(),
  );
  await context.route('https://*.tile.opentopomap.org/**', (route) => route.abort());
});

const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function createTrip(page: Page, name: string, start = '2031-06-01', end = '2031-06-03') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill(start);
  await dialog.getByLabel('Au', { exact: true }).fill(end);
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('plus de page d’accueil : « / » rouvre le dernier voyage consulté', async ({ page }) => {
  const first = uniqueName('Dernier vu');
  const second = uniqueName('Créé ensuite');
  await createTrip(page, first);
  const firstUrl = page.url();
  await createTrip(page, second);
  await page.getByRole('combobox', { name: 'Choisir un voyage' }).click();
  await page
    .getByRole('listbox', { name: 'Voyages' })
    .getByRole('option', { name: first, exact: true })
    .click();
  await expect(page).toHaveURL(firstUrl);

  await page.goto('/');
  await expect(page).toHaveURL(firstUrl);
  await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mes voyages' })).toHaveCount(0);
});

test('sans voyage : invitation à créer le premier', async ({ browser }) => {
  const { context, page } = await newUser(browser, 'sans-voyage');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Aucun voyage pour l’instant' })).toBeVisible();
  await page.getByRole('button', { name: 'Créer un voyage' }).click();
  await expect(page.getByRole('dialog', { name: 'Nouveau voyage' })).toBeVisible();
  await context.close();
});

test('illustration choisie depuis les paramètres du voyage', async ({ page }) => {
  const name = uniqueName('Escapade Alpes');
  await createTrip(page, name);
  await page.getByRole('button', { name: 'Paramètres du voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le voyage' });
  // Sans choix, l'illustration est suggérée par le nom (« Alpes » : montagne).
  await expect(dialog.getByText('Automatique : Montagne')).toBeVisible();
  await dialog.getByRole('button', { name: 'Changer l’illustration' }).click();
  // Bouton radio masqué dans son libellé : cliquer le libellé.
  await dialog.getByText('Van', { exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Van' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(dialog).toHaveCount(0);

  // Le pictogramme s'affiche dans la liste des voyages de l'en-tête.
  const switcher = page.getByRole('combobox', { name: 'Choisir un voyage' });
  await expect(switcher.locator('[data-illustration="van"] svg')).toBeVisible();
  await switcher.click();
  await expect(
    page.getByRole('option', { name, exact: true }).locator('[data-illustration="van"]'),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // Choix conservé : aperçu de la scène dans les paramètres, après rechargement.
  await page.reload();
  await page.getByRole('button', { name: 'Paramètres du voyage' }).click();
  await expect(dialog.locator('[data-illustration="van"] svg')).toBeVisible();
});

test('illustration suggérée par le nom du voyage, sans rien choisir', async ({ page }) => {
  await createTrip(page, uniqueName('Randonnée'));
  const switcher = page.getByRole('combobox', { name: 'Choisir un voyage' });
  await expect(switcher.locator('[data-illustration="randonnee"] svg')).toBeVisible();
});
