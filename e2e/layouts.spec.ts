import { expect, test, type Page } from '@playwright/test';
import { addPlaceViaMap } from './place-helpers';

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

async function createTrip(page: Page) {
  const name = uniqueName('Affichages');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return name;
}

const stopNames = (page: Page) => page.getByTestId('metro-stop').locator('.name').allTextContents();

test('choisir l’affichage sur Mon compte, puis basculer depuis la page du voyage', async ({
  page,
}) => {
  await page.goto('/compte');
  await page.getByRole('radio', { name: /Ligne de métro/ }).check();
  const name = await createTrip(page);
  await page.getByRole('tab', { name: /J1/ }).click();
  await addPlaceViaMap(page, 'Louvre', 'Musée du Louvre');

  // Ligne de métro (choix de Mon compte).
  await expect(page.getByTestId('metro-stop')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Ligne de métro' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Plein écran : colonnes des jours, puis la carte.
  await page.getByRole('button', { name: 'Plein écran' }).click();
  const j1 = page.getByRole('region', { name: 'J1', exact: true });
  await expect(j1.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'J3', exact: true })).toBeVisible();
  await page
    .getByRole('group', { name: 'Plein écran' })
    .getByRole('button', { name: 'Carte' })
    .click();
  await expect(page.getByTestId('trip-map')).toBeVisible();

  // Retour à la liste, mémorisé au rechargement.
  await page.getByRole('button', { name: 'Liste et carte' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Liste et carte' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('ligne de métro : ajouter, relier par un trajet, réordonner et glisser', async ({ page }) => {
  await createTrip(page);
  await page.getByRole('button', { name: 'Ligne de métro' }).click();
  await page.getByRole('tab', { name: /J1/ }).click();
  await addPlaceViaMap(page, 'Louvre', 'Musée du Louvre');
  await addPlaceViaMap(page, 'Orsay', 'Musée d’Orsay');
  await expect.poll(() => stopNames(page)).toEqual(['Musée du Louvre', 'Musée d’Orsay']);

  // Trajet entre les deux stations : « + » compact qui se déplie pour choisir le mode.
  const line = page.getByTestId('day-timeline');
  const leg = line.getByTestId('metro-leg');
  await leg.getByRole('button', { name: 'Ajouter un trajet' }).click();
  await leg.getByRole('button', { name: 'Trajet en Voiture' }).click();
  await expect(leg).toContainText('Voiture');
  await expect(leg.getByRole('button', { name: /^Trajet en/ })).toHaveCount(0);
  // Compact : pas plus large qu'une station.
  const box = await leg.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(150);

  // Glisser la dernière station dans la première zone de dépôt : l'ordre change.
  await page.getByTestId('metro-stop').last().dragTo(line.getByTestId('drop-zone').first());
  await expect.poll(() => stopNames(page)).toEqual(['Musée d’Orsay', 'Musée du Louvre']);

  // Un clic sur une station ouvre l'éditeur.
  await page.getByRole('button', { name: /^Musée du Louvre · Musée/ }).click();
  await expect(page.getByRole('dialog', { name: 'Modifier l’étape' })).toBeVisible();
});

test('plein écran : ajouter depuis la carte dans un jour choisi, glisser d’un jour à l’autre', async ({
  page,
}) => {
  await createTrip(page);
  await page.getByRole('button', { name: 'Plein écran' }).click();
  // Plus de boutons d'ajout dans les colonnes : le bouton « Lieu » de la carte, jour choisi.
  await page.getByRole('button', { name: 'Carte', exact: true }).click();
  await addPlaceViaMap(page, 'Louvre', 'Musée du Louvre', { day: 1 });
  await addPlaceViaMap(page, 'Orsay', 'Musée d’Orsay', { day: 2 });
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  const j1 = page.getByRole('region', { name: 'J1', exact: true });
  const j2 = page.getByRole('region', { name: 'J2', exact: true });
  await expect(j1.getByTestId('step-card')).toHaveCount(1);
  await expect(j2.getByTestId('step-card').filter({ hasText: 'Musée d’Orsay' })).toBeVisible();

  // Glisser l'étape de J1 dans la colonne J2.
  await j1.getByTestId('step-card').dragTo(j2.getByTestId('drop-zone').last());
  await expect(j1.getByTestId('step-card')).toHaveCount(0);
  await expect(j2.getByTestId('step-card')).toHaveCount(2);
});
