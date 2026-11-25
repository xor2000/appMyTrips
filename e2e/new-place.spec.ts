import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { clickMapAt, type MapTestWindow } from './map-helpers';
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
const timeline = (page: Page) => page.getByTestId('day-timeline');
const ideas = (page: Page) => page.getByRole('region', { name: 'Idées' });

/** Voyage de trois jours, J1 affiché. */
async function tripOnDay1(page: Page) {
  const name = uniqueName('Lieu');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
}

test('plus de boutons d’ajout sous les lieux du jour, dans les trois affichages', async ({
  page,
}) => {
  await tripOnDay1(page);
  for (const layout of ['Liste et carte', 'Ligne de métro', 'Plein écran']) {
    await page.getByRole('button', { name: layout, exact: true }).click();
    for (const name of [
      'Ajouter un lieu',
      'Ajouter un séjour',
      'Importer une randonnée (GPX)',
      'Ajouter une idée',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(page.getByText('Importer une randonnée (GPX)')).toHaveCount(0);
  }
});

test('bouton « Lieu » : rechercher, compléter dans « Nouveau lieu », ajouter au jour', async ({
  page,
}) => {
  await tripOnDay1(page);
  await page.getByRole('button', { name: 'Lieu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Louvre');
  await dialog.getByRole('button', { name: /Musée du Louvre/ }).click();

  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  await expect(form.getByLabel('Nom du lieu')).toHaveValue('Musée du Louvre');
  await expect(form.getByRole('radio', { name: 'Musée' })).toBeChecked();
  await form.getByLabel('Notes').fill('Billets coupe-file');
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(timeline(page).getByTestId('step-card')).toContainText(['Musée du Louvre']);
});

test('coordonnées GPS saisies : lieu situé, rangé dans les idées', async ({ page }) => {
  await tripOnDay1(page);
  await page.getByRole('button', { name: 'Lieu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByText('Coordonnées', { exact: true }).click();
  await dialog.getByLabel('Latitude').fill('48.8584, 2.2945');
  await dialog.getByRole('button', { name: 'Utiliser ce point' }).click();

  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  // Nom du lieu le plus proche (géocodage inverse factice), point saisi.
  await expect(form.getByLabel('Nom du lieu')).toHaveValue('Lieu sur la carte');
  await expect(form.getByLabel('Latitude')).toHaveValue('48.858400');
  await expect(form.getByLabel('Longitude')).toHaveValue('2.294500');
  await form.getByLabel(/^Jour/).selectOption({ label: 'Idées (pas encore placé)' });
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(ideas(page).getByTestId('step-card')).toContainText(['Lieu sur la carte']);
});

test('choisir sur la carte : fenêtre masquée, clic sur la carte, puis « Nouveau lieu »', async ({
  page,
}) => {
  await tripOnDay1(page);
  await page.getByRole('button', { name: 'Lieu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByText('Sur la carte', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Choisir sur la carte' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Cliquez sur la carte' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => typeof (window as MapTestWindow).__mapProjectForTests))
    .toBe('function');
  await clickMapAt(page, [2.3376, 48.8606]);

  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  await expect(form.getByLabel('Nom du lieu')).toHaveValue('Lieu sur la carte');
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(timeline(page).getByTestId('step-card')).toContainText(['Lieu sur la carte']);
});

test('catégorie « Séjour » : un séjour de 2 nuits, en fin de J1, dans J2 et au début de J3', async ({
  page,
}) => {
  await tripOnDay1(page);
  await page.getByRole('button', { name: 'Lieu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Hôtel des Arts');
  await dialog.getByRole('button', { name: /Hôtel des Arts/ }).click();
  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  await form.getByText('Séjour', { exact: true }).click();
  await expect(form.getByLabel('Arrivée le')).toHaveValue('2026-07-10');
  await form.getByLabel('Départ le').fill('2026-07-12');
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();

  const stays = timeline(page).getByTestId('stay-card');
  await expect(stays).toHaveText([/Hôtel des Arts.*Check-in · 17:00/]);
  await page.getByRole('tab', { name: /J2/ }).click();
  await expect(stays).toHaveText([/Départ · 10:00/, /Retour · 17:00/]);
  await page.getByRole('tab', { name: /J3/ }).click();
  await expect(stays).toHaveText([/Check-out · 10:00/]);
});

test('catégorie « Randonnée » : GPX importé dès la création', async ({ page }) => {
  await tripOnDay1(page);
  await page.getByRole('button', { name: 'Lieu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Louvre');
  await dialog.getByRole('button', { name: /Musée du Louvre/ }).click();
  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  await form.getByText('Randonnée', { exact: true }).click();
  await form.getByLabel('Importer un GPX').setInputFiles({
    name: 'crete.gpx',
    mimeType: 'application/gpx+xml',
    buffer: readFileSync(new URL('../packages/core/test/fixtures/linear.gpx', import.meta.url)),
  });
  await expect(form).toContainText('km');
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(timeline(page).getByTestId('step-card')).toContainText(['GPX']);
  await expect(page.locator('.map-marker', { hasText: '⚑' })).toHaveCount(1);
});

test('la recherche de la carte ouvre la même fenêtre ; sur « Tout le voyage », dans les idées', async ({
  page,
}) => {
  await tripOnDay1(page);
  await page.getByRole('tab', { name: 'Tout le voyage' }).click();
  await page.getByRole('button', { name: /Rechercher un lieu, une adresse/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Orsay');
  await dialog.getByRole('button', { name: /Musée d’Orsay/ }).click();
  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  await expect(form.getByLabel(/^Jour/)).toHaveValue('');
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(ideas(page).getByTestId('step-card')).toContainText(['Musée d’Orsay']);

  // Le helper commun place par défaut dans le jour affiché.
  await page.getByRole('tab', { name: /J2/ }).click();
  await addPlaceViaMap(page, 'Louvre', 'Musée du Louvre');
  await expect(timeline(page).getByTestId('step-card')).toContainText(['Musée du Louvre']);
});
