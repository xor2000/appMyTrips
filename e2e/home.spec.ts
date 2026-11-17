import { expect, test, type Page } from '@playwright/test';

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

async function createTrip(page: Page, name: string, start: string, end: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill(start);
  await dialog.getByLabel('Au', { exact: true }).fill(end);
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('photo de couverture : proposée à l’accueil, puis changée depuis « Modifier »', async ({
  page,
}) => {
  const name = uniqueName('Escapade Alpes');
  await createTrip(page, name, '2031-06-01', '2031-06-03');

  // Accueil : le voyage reçoit la première photo trouvée sur Commons (services factices).
  await page.getByRole('link', { name: 'Retour aux voyages' }).click();
  const card = page.getByRole('article').filter({ hasText: name });
  await expect(card.locator('img')).toHaveAttribute('src', /commons-img\/1\.jpg/);
  await expect(card.getByRole('link', { name: /Photographe factice/ })).toBeVisible();

  // Changer la photo depuis la page du voyage.
  await card.getByRole('link', { name: /ouvrir le carnet/i }).click();
  await page.getByRole('button', { name: 'Modifier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le voyage' });
  await dialog.getByRole('button', { name: 'Changer la photo' }).click();
  await dialog.getByRole('radio', { name: 'Photo 2 : Photographe factice' }).check();
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('link', { name: 'Retour aux voyages' }).click();
  await expect(card.locator('img')).toHaveAttribute('src', /commons-img\/2\.jpg/);
});

test('accueil : un voyage passé est rangé dans « Souvenirs »', async ({ page }) => {
  const name = uniqueName('Souvenir');
  await createTrip(page, name, '2025-03-01', '2025-03-02');
  await page.getByRole('link', { name: 'Retour aux voyages' }).click();
  const memories = page.getByRole('region', { name: 'Souvenirs' });
  await expect(memories.getByRole('article').filter({ hasText: name })).toBeVisible();
});
