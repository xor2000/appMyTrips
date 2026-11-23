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

/** Voyage avec le Louvre et Orsay sur J1 (services factices). */
async function tripWithTwoPlaces(page: Page) {
  const name = uniqueName('Popup');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
  for (const [query, result] of [
    ['Louvre', 'Musée du Louvre'],
    ['Orsay', 'Musée d’Orsay'],
  ] as const) {
    await page.getByRole('button', { name: 'Ajouter un lieu' }).click();
    const add = page.getByRole('dialog', { name: 'Ajouter un lieu' });
    await add.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill(query);
    await add.getByRole('button', { name: new RegExp(result) }).click();
    await expect(add).toHaveCount(0);
  }
}

const cardButton = (page: Page, name: string) =>
  page
    .getByTestId('day-timeline')
    .getByTestId('step-card')
    .filter({ hasText: name })
    .getByRole('button', { name: new RegExp(`${name} Musée`) });

test('clic sur un lieu de la colonne : sélection, zoom et popup, sans ouvrir l’édition', async ({
  page,
}) => {
  await tripWithTwoPlaces(page);
  await cardButton(page, 'Musée d’Orsay').click();

  await expect(page.getByRole('dialog', { name: 'Modifier l’étape' })).toHaveCount(0);
  const popup = page.getByTestId('step-popup');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('Musée · J1');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Musée d’Orsay');
  await expect(popup.getByRole('button', { name: 'Modifier' })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Supprimer' })).toBeVisible();
  // Zoom sur le lieu (au moins 15, comme la référence) et carte sélectionnée.
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __mapZoomForTests: () => number }).__mapZoomForTests(),
      ),
    )
    .toBeGreaterThanOrEqual(15);
  await expect(page.getByTestId('step-card').filter({ hasText: 'Musée d’Orsay' })).toHaveClass(
    /highlighted/,
  );

  // « Modifier » ouvre l'éditeur et ferme la popup.
  await popup.getByRole('button', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await expect(editor).toBeVisible();
  await expect(popup).toHaveCount(0);
  await editor.getByRole('button', { name: 'Annuler' }).click();

  // « Supprimer » demande confirmation.
  await cardButton(page, 'Musée du Louvre').click();
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Musée du Louvre');
  await popup.getByRole('button', { name: 'Supprimer' }).click();
  await page
    .getByRole('alertdialog', { name: 'Supprimer l’étape ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' })).toHaveCount(0);
});

test('passer d’un lieu à l’autre garde la sélection du nouveau', async ({ page }) => {
  await tripWithTwoPlaces(page);
  await cardButton(page, 'Musée d’Orsay').click();
  await cardButton(page, 'Musée du Louvre').click();
  const popup = page.getByTestId('step-popup');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Musée du Louvre');
  // Souris hors de la colonne : seule la sélection met la carte en évidence.
  await page.mouse.move(1000, 800);
  await expect(page.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' })).toHaveClass(
    /highlighted/,
  );
  await expect(page.getByTestId('step-card').filter({ hasText: 'Musée d’Orsay' })).not.toHaveClass(
    /highlighted/,
  );
});

test('clic sur un marqueur de la carte : même popup', async ({ page }) => {
  await tripWithTwoPlaces(page);
  await page.locator('.map-marker', { hasText: '2' }).click();
  const popup = page.getByTestId('step-popup');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Musée d’Orsay');
  await expect(popup).toContainText('Musée · J1');
});
