import { expect, test, type Locator, type Page } from '@playwright/test';
import { accountButton, DEV_EMAIL } from './auth-helpers';

/** Style de carte minimal : les e2e ne dépendent pas des serveurs de tuiles. */
const EMPTY_STYLE = { version: 8, sources: {}, layers: [] };

test.beforeEach(async ({ context }) => {
  await context.route('https://tiles.openfreemap.org/**', (route) =>
    route.request().url().includes('/styles/')
      ? route.fulfill({ json: EMPTY_STYLE })
      : route.abort(),
  );
  await context.route('https://*.tile.opentopomap.org/**', (route) => route.abort());
});

const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function createTrip(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

const tripSelect = (page: Page) => page.getByRole('combobox', { name: 'Choisir un voyage' });

/** Centre vertical d'un élément, pour vérifier qu'ils sont sur une même ligne. */
async function centerY(l: Locator) {
  const box = await l.boundingBox();
  return box ? box.y + box.height / 2 : NaN;
}

test('en-tête : logo et nom de l’application, menu du profil', async ({ page }) => {
  await page.goto('/compte');
  const banner = page.getByRole('banner');
  const brand = banner.getByRole('link', { name: 'MyTrips, accueil' });
  await expect(brand).toBeVisible();
  await expect(brand).toContainText('MyTrips');
  await expect(banner.getByText(DEV_EMAIL)).toHaveCount(0);

  await accountButton(page, DEV_EMAIL).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitemradio')).toHaveCount(4);
  await menu.getByRole('menuitem', { name: 'Paramètres' }).click();
  await expect(page).toHaveURL(/\/compte$/);
  await expect(menu).toHaveCount(0);
});

test('page voyage : voyages, paramètres, ajout et jours sur une seule ligne compacte', async ({
  page,
}) => {
  const name = uniqueName('En-tête');
  await createTrip(page, name);

  const banner = page.getByRole('banner');
  await expect(tripSelect(page).locator('option:checked')).toHaveText(name);
  const brand = banner.getByRole('link', { name: 'MyTrips, accueil' });
  const settings = banner.getByRole('button', { name: 'Paramètres du voyage' });
  const add = banner.getByRole('button', { name: 'Nouveau voyage' });
  const day = banner.getByRole('tab', { name: /J1/ });
  const share = banner.getByRole('button', { name: 'Partager' });
  for (const el of [brand, settings, add, day, share]) await expect(el).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Retour aux voyages' })).toHaveCount(0);

  // Une seule ligne, dans l'ordre : nom de l'appli, voyage, roue, +, puis les jours.
  const profileY = await centerY(accountButton(page));
  for (const el of [brand, tripSelect(page), settings, add, day, share]) {
    expect(Math.abs((await centerY(el)) - profileY)).toBeLessThan(4);
  }
  const x = async (l: Locator) => (await l.boundingBox())?.x ?? NaN;
  expect(await x(tripSelect(page))).toBeGreaterThan(await x(brand));
  expect(await x(settings)).toBeGreaterThan(await x(tripSelect(page)));
  expect(await x(add)).toBeGreaterThan(await x(settings));
  expect(await x(day)).toBeGreaterThan(await x(add));
  // En-tête réduit : une ligne d'au plus 64 px.
  expect((await banner.boundingBox())?.height ?? 999).toBeLessThanOrEqual(64);

  // Police de la référence.
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain('Manrope');
});

test('changer de voyage depuis la liste déroulante de l’en-tête', async ({ page }) => {
  const first = uniqueName('Premier');
  const second = uniqueName('Second');
  await createTrip(page, first);
  const firstUrl = page.url();
  await createTrip(page, second);

  await tripSelect(page).selectOption({ label: first });
  await expect(page).toHaveURL(firstUrl);
  await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible();
  await expect(tripSelect(page).locator('option:checked')).toHaveText(first);
});

test('fenêtres : fond flouté et bouton de fermeture', async ({ page }) => {
  await createTrip(page, uniqueName('Fenêtres'));
  await page.getByRole('button', { name: 'Paramètres du voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le voyage' });
  await expect(dialog).toBeVisible();
  const blur = await dialog.evaluate(
    (el) => getComputedStyle(el.parentElement as HTMLElement).backdropFilter,
  );
  expect(blur).toContain('blur');
  await dialog.getByRole('button', { name: 'Fermer la fenêtre' }).click();
  await expect(dialog).toHaveCount(0);
});

test('tablette : les jours passent sous la ligne du voyage, entiers', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await createTrip(page, uniqueName('Tablette'));
  const select = tripSelect(page);
  const day = page.getByRole('banner').getByRole('tab', { name: /J1/ });
  const selectBox = await select.boundingBox();
  const dayBox = await day.boundingBox();
  expect(dayBox?.width ?? 0).toBeGreaterThan(50);
  expect(dayBox?.y ?? 0).toBeGreaterThan((selectBox?.y ?? 0) + (selectBox?.height ?? 0));
  // Actions et profil restent sur la première ligne.
  const profileY = await centerY(accountButton(page));
  expect(
    Math.abs((await centerY(page.getByRole('button', { name: 'Partager' }))) - profileY),
  ).toBeLessThan(4);
  expect(Math.abs((await centerY(select)) - profileY)).toBeLessThan(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
