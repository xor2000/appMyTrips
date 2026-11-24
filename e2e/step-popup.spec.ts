import { expect, test, type Page } from '@playwright/test';
import { clickMapAt } from './map-helpers';

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

const zoom = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __mapZoomForTests: () => number }).__mapZoomForTests(),
  );

test('clic sur un trajet : la carte cadre le tracé et ouvre sa popup (infos, Modifier, Supprimer)', async ({
  page,
}) => {
  await tripWithTwoPlaces(page);
  const tile = page.getByTestId('day-timeline').getByTestId('leg-tile');
  // Sans trajet, l'ajout n'apparaît qu'au survol de l'espace entre les lieux.
  await tile.hover();
  await tile.getByRole('button', { name: 'Trajet en Voiture' }).click();
  await expect(tile).toContainText('25 min');

  await tile.getByRole('button', { name: /Voiture/ }).click();
  await expect(page.getByRole('dialog', { name: 'Modifier le trajet' })).toHaveCount(0);
  const popup = page.getByTestId('leg-popup');
  await expect(popup).toContainText('Voiture · J1');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText(
    'Musée du Louvre → Musée d’Orsay',
  );
  await expect(popup).toContainText('12 km · 25 min');
  // Cadrage sur le tracé (zoom 16 au plus, comme la référence).
  await expect.poll(() => zoom(page)).toBeGreaterThan(10);
  expect(await zoom(page)).toBeLessThanOrEqual(16);

  await popup.getByRole('button', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier le trajet' });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Fermer la fenêtre' }).click();

  await tile.getByRole('button', { name: /Voiture/ }).click();
  await popup.getByRole('button', { name: 'Supprimer' }).click();
  await expect(tile).toContainText('+ trajet');
  await expect(popup).toHaveCount(0);
});

test('clic sur une idée qui a un lieu : zoom et popup « … · Idée »', async ({ page }) => {
  await tripWithTwoPlaces(page);
  await page.getByRole('button', { name: 'Ajouter une idée' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une idée' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Eiffel');
  await dialog.getByRole('button', { name: /Tour Eiffel/ }).click();
  await expect(dialog).toHaveCount(0);

  const ideas = page.getByRole('region', { name: 'Idées' });
  await ideas
    .getByTestId('step-card')
    .getByRole('button', { name: /Tour Eiffel/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: 'Modifier l’étape' })).toHaveCount(0);
  const popup = page.getByTestId('step-popup');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Tour Eiffel');
  await expect(popup).toContainText('· Idée');
  await expect.poll(() => zoom(page)).toBeGreaterThanOrEqual(15);
});

test('clic droit sur la carte : popup du lieu trouvé par Photon, ajout au jour', async ({
  page,
}) => {
  await tripWithTwoPlaces(page);
  // Entre le Louvre et Orsay, loin des marqueurs.
  await clickMapAt(page, [2.332, 48.8615], { button: 'right' });
  const popup = page.getByTestId('poi-popup');
  // Lieu renvoyé par le géocodage inverse factice (e2e/mock-services.mjs).
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Lieu sur la carte');
  await expect(popup).toContainText('Autre · OpenStreetMap');
  await expect(popup).toContainText('Paris, France');
  await expect(popup.getByRole('button', { name: 'Ajouter aux idées' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter ici' })).toHaveCount(0);

  await popup.getByRole('button', { name: 'Ajouter à J1' }).click();
  await expect(popup).toHaveCount(0);
  await expect(
    page
      .getByTestId('day-timeline')
      .getByTestId('step-card')
      .filter({ hasText: 'Lieu sur la carte' }),
  ).toHaveCount(1);

  // Même lieu OSM ailleurs : déjà ajouté.
  await clickMapAt(page, [2.3315, 48.8592], { button: 'right' });
  await expect(popup).toContainText('Déjà ajouté');
  await expect(popup.getByRole('button', { name: 'Supprimer' })).toBeVisible();
});
