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
const timeline = (page: Page) => page.getByTestId('day-timeline');
const card = (page: Page, name: string) =>
  timeline(page).getByTestId('step-card').filter({ hasText: name });

/** Voyage (journées 08:00 → 22:00) avec les lieux donnés sur J1 (Photon factice). */
async function tripWithPlaces(page: Page, places: [string, string][]) {
  const name = uniqueName('Horaires');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
  for (const [query, result] of places) {
    await page.getByRole('button', { name: 'Ajouter un lieu' }).click();
    const add = page.getByRole('dialog', { name: 'Ajouter un lieu' });
    await add.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill(query);
    await add.getByRole('button', { name: new RegExp(result) }).click();
    await expect(add).toHaveCount(0);
  }
}

/** Crée un trajet en voiture (25 min, ORS factice) sur chaque tuile vide, une à une. */
async function carEverywhere(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await timeline(page)
      .getByTestId('leg-tile')
      .filter({ hasText: '+ trajet' })
      .first()
      .getByRole('button', { name: 'Trajet en Voiture' })
      .click();
    await expect(
      timeline(page).getByTestId('leg-tile').filter({ hasText: '+ trajet' }),
    ).toHaveCount(count - i - 1);
  }
}

test('4 étapes et leurs trajets : heures affichées et cohérentes', async ({ page }) => {
  await tripWithPlaces(page, [
    ['Louvre', 'Musée du Louvre'],
    ['Orsay', 'Musée d’Orsay'],
    ['Eiffel', 'Tour Eiffel'],
    ['Notre-Dame', 'Notre-Dame de Paris'],
  ]);
  await carEverywhere(page, 3);
  await expect(card(page, 'Musée du Louvre')).toContainText('08:00 → 10:00');
  await expect(card(page, 'Musée d’Orsay')).toContainText('10:25 → 12:25');
  await expect(card(page, 'Tour Eiffel')).toContainText('12:50 → 14:50');
  await expect(card(page, 'Notre-Dame de Paris')).toContainText('15:15 → 16:00');
  await expect(page.getByRole('img', { name: /Sur place 6 h 45 · Trajets 1 h 15/ })).toBeVisible();
});

test('une heure fixe en conflit : « Réorganiser », appliquer, puis Ctrl+Z', async ({ page }) => {
  await tripWithPlaces(page, [
    ['Louvre', 'Musée du Louvre'],
    ['Orsay', 'Musée d’Orsay'],
  ]);
  await carEverywhere(page, 1);

  // Orsay à 10:00, alors qu'on y arrive à 10:25.
  await card(page, 'Musée d’Orsay')
    .getByRole('button', { name: /Musée d’Orsay Musée/ })
    .click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await editor.getByLabel('Heure fixe').check();
  await editor.getByLabel('Heure', { exact: true }).fill('10:00');
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(card(page, 'Musée d’Orsay')).toContainText('Conflit +25 min');
  const banner = page.getByRole('status').filter({ hasText: 'conflit' });
  await expect(banner).toContainText('1 conflit');
  await expect(page.getByRole('tab', { name: /J1.*à revoir/ })).toBeVisible();

  await banner.getByRole('button', { name: 'Réorganiser' }).click();
  const panel = page.getByRole('dialog', { name: 'Réorganiser la journée' });
  await expect(panel).toContainText('Raccourcir : Musée du Louvre 2 h → 1 h 35');
  await panel
    .getByRole('button', { name: /^Appliquer/ })
    .first()
    .click();
  await expect(panel).toHaveCount(0);
  await expect(card(page, 'Musée d’Orsay')).not.toContainText('Conflit');
  await expect(card(page, 'Musée du Louvre')).toContainText('08:00 → 09:35');

  await page.keyboard.press('Control+z');
  await expect(card(page, 'Musée d’Orsay')).toContainText('Conflit +25 min');
  await page.keyboard.press('Control+y');
  await expect(card(page, 'Musée d’Orsay')).not.toContainText('Conflit');
});

test('journée trop longue : bandeau de dépassement', async ({ page }) => {
  await tripWithPlaces(page, [['Louvre', 'Musée du Louvre']]);
  await card(page, 'Musée du Louvre')
    .getByRole('button', { name: /Musée du Louvre Musée/ })
    .click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await editor.getByLabel('Durée sur place (min)').fill('900');
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(card(page, 'Musée du Louvre')).toContainText('08:00 → 23:00');
  await expect(page.getByRole('status').filter({ hasText: 'Dépasse' })).toContainText(
    'Dépasse la journée de 1 h',
  );
});
