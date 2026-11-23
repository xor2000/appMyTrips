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

/** Voyage avec deux étapes sur J1 : Louvre puis Orsay (routage par les services factices). */
async function tripWithTwoSteps(page: Page) {
  const name = uniqueName('Trajets');
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

const timeline = (page: Page) => page.getByTestId('day-timeline');

test('entre deux étapes, la tuile « + trajet » crée un trajet en voiture, tracé sur la carte', async ({
  page,
}) => {
  await tripWithTwoSteps(page);
  const tile = timeline(page).getByTestId('leg-tile');
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText('+ trajet');
  await expect(page.getByTestId('trip-map')).toHaveAttribute('data-leg-lines', '0');

  await tile.getByRole('button', { name: 'Trajet en Voiture' }).click();
  await expect(tile).toContainText('25 min · 12 km');
  await expect(tile).toContainText('routeur');
  await expect(page.getByTestId('trip-map')).toHaveAttribute('data-leg-lines', '1');
  // Mention exigée par la politique d'usage du serveur OSRM de FOSSGIS.
  const attribution = page.getByTestId('trip-map').locator('.maplibregl-ctrl-attrib-inner');
  await expect(attribution).toContainText('OSRM');
  await expect(attribution).not.toContainText('openrouteservice');
});

test('forcer la durée affiche « forcé », puis recalculer revient au routeur', async ({ page }) => {
  await tripWithTwoSteps(page);
  const tile = timeline(page).getByTestId('leg-tile');
  await tile.getByRole('button', { name: 'Trajet en Voiture' }).click();
  await expect(tile).toContainText('routeur');

  await tile.getByRole('button', { name: /Voiture/ }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier le trajet' });
  await editor.getByLabel('Durée (min)').fill('45');
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(tile).toContainText('45 min');
  await expect(tile).toContainText('forcé');

  await tile.getByRole('button', { name: /Voiture/ }).click();
  await editor.getByRole('button', { name: 'Recalculer' }).click();
  await expect(tile).toContainText('25 min');
  await expect(tile).toContainText('routeur');
});

test('réordonner les étapes retire l’ancien trajet ; un trajet forcé est proposé à la reprise', async ({
  page,
}) => {
  await tripWithTwoSteps(page);
  const tile = timeline(page).getByTestId('leg-tile');
  await tile.getByRole('button', { name: 'Trajet en Voiture' }).click();
  await tile.getByRole('button', { name: /Voiture/ }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier le trajet' });
  await editor.getByLabel('Durée (min)').fill('45');
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(tile).toContainText('forcé');

  // Orsay passe avant le Louvre : la paire Louvre → Orsay n'existe plus.
  await timeline(page).getByTestId('step-card').filter({ hasText: 'Musée d’Orsay' }).hover();
  await page.getByRole('button', { name: 'Monter Musée d’Orsay' }).click();
  await expect(timeline(page).getByTestId('step-card').first()).toContainText('Musée d’Orsay');
  await expect(tile).toContainText('+ trajet');
  await expect(page.getByTestId('trip-map')).toHaveAttribute('data-leg-lines', '0');

  await tile.getByRole('button', { name: 'Reprendre : Voiture 45 min' }).click();
  await expect(tile).toContainText('45 min');
  await expect(tile).toContainText('forcé');
});

test('aucun itinéraire en train : saisie manuelle de la durée', async ({ page }) => {
  await tripWithTwoSteps(page);
  const tile = timeline(page).getByTestId('leg-tile');
  await tile.getByRole('button', { name: 'Trajet en Train' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau trajet' });
  await expect(dialog).toContainText('Aucun itinéraire trouvé');
  await dialog.getByLabel('Durée (min)').fill('35');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(tile).toContainText('Train');
  await expect(tile).toContainText('35 min');
  await expect(tile).toContainText('forcé');
});
