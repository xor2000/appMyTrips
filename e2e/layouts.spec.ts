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

test('choisir l’affichage sur Mon compte, puis basculer depuis la page du voyage', async ({
  page,
}) => {
  // Deux affichages seulement : plus de « Ligne de métro ».
  await page.goto('/compte');
  const layouts = page.getByRole('radiogroup', { name: 'Affichage de la journée' });
  await expect(layouts.getByRole('radio')).toHaveCount(2);
  await expect(layouts.getByRole('radio', { name: /Ligne de métro/ })).toHaveCount(0);
  await layouts.getByRole('radio', { name: /Plein écran/ }).check();
  const name = await createTrip(page);
  await expect(page.getByRole('button', { name: 'Ligne de métro' })).toHaveCount(0);

  // Plein écran (choix de Mon compte) : colonnes des jours, puis la carte.
  await expect(page.getByRole('button', { name: 'Plein écran' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Carte', exact: true }).click();
  await addPlaceViaMap(page, 'Louvre', 'Musée du Louvre', { day: 1 });
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
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
