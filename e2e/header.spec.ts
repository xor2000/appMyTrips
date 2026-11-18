import { expect, test } from '@playwright/test';
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

test('en-tête compact : logo seul et menu du profil', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('link', { name: 'MyTrips, accueil' })).toBeVisible();
  await expect(banner.getByText('MyTrips', { exact: true })).toHaveCount(0);
  await expect(banner.getByText(DEV_EMAIL)).toHaveCount(0);

  await accountButton(page, DEV_EMAIL).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitemradio')).toHaveCount(4);
  await menu.getByRole('menuitem', { name: 'Paramètres' }).click();
  await expect(page).toHaveURL(/\/compte$/);
  await expect(menu).toHaveCount(0);
});

test('page voyage : logo, titre, actions et profil sur une seule ligne', async ({ page }) => {
  const name = uniqueName('En-tête');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();

  const banner = page.getByRole('banner');
  const title = banner.getByRole('heading', { level: 1, name });
  await expect(title).toBeVisible();
  await expect(banner.getByRole('link', { name: 'MyTrips, accueil' })).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Retour aux voyages' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Partager' })).toBeVisible();
  await expect(accountButton(page)).toHaveCount(1);

  // Une seule ligne : logo, titre et profil ont leur centre à la même hauteur.
  const center = async (l: ReturnType<typeof page.locator>) => {
    const box = await l.boundingBox();
    return box ? box.y + box.height / 2 : NaN;
  };
  const logoY = await center(banner.getByRole('link', { name: 'MyTrips, accueil' }));
  const shareY = await center(banner.getByRole('button', { name: 'Partager' }));
  const profileY = await center(accountButton(page));
  expect(Math.abs(logoY - profileY)).toBeLessThan(4);
  expect(Math.abs(shareY - profileY)).toBeLessThan(4);
  // Les jours restent sous l'en-tête.
  await expect(page.getByRole('tab', { name: /Tout le voyage/ })).toBeVisible();
});
