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
    await addPlaceViaMap(page, query, result);
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

  // Sans trajet, l'ajout n'apparaît qu'au survol de l'espace entre les lieux.

  await tile.hover();

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
  // Sans trajet, l'ajout n'apparaît qu'au survol de l'espace entre les lieux.
  await tile.hover();
  await tile.getByRole('button', { name: 'Trajet en Voiture' }).click();
  await expect(tile).toContainText('routeur');

  // Le clic sur le trajet ouvre sa popup sur la carte ; « Modifier » ouvre l'éditeur.
  await tile.getByRole('button', { name: /Voiture/ }).click();
  await page.getByTestId('leg-popup').getByRole('button', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier le trajet' });
  await editor.getByLabel('Durée (min)').fill('45');
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(tile).toContainText('45 min');
  await expect(tile).toContainText('forcé');

  await tile.getByRole('button', { name: /Voiture/ }).click();
  await page.getByTestId('leg-popup').getByRole('button', { name: 'Modifier' }).click();
  await editor.getByRole('button', { name: 'Recalculer' }).click();
  await expect(tile).toContainText('25 min');
  await expect(tile).toContainText('routeur');
});

test('réordonner les étapes retire l’ancien trajet ; un trajet forcé est proposé à la reprise', async ({
  page,
}) => {
  await tripWithTwoSteps(page);
  const tile = timeline(page).getByTestId('leg-tile');
  // Sans trajet, l'ajout n'apparaît qu'au survol de l'espace entre les lieux.
  await tile.hover();
  await tile.getByRole('button', { name: 'Trajet en Voiture' }).click();
  // Le clic sur le trajet ouvre sa popup sur la carte ; « Modifier » ouvre l'éditeur.
  await tile.getByRole('button', { name: /Voiture/ }).click();
  await page.getByTestId('leg-popup').getByRole('button', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier le trajet' });
  await editor.getByLabel('Durée (min)').fill('45');
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(tile).toContainText('forcé');

  // Orsay passe avant le Louvre : la paire Louvre → Orsay n'existe plus.
  await timeline(page)
    .getByTestId('step-card')
    .filter({ hasText: 'Musée d’Orsay' })
    .dragTo(timeline(page).getByTestId('drop-zone').first());
  await expect(timeline(page).getByTestId('step-card').first()).toContainText('Musée d’Orsay');
  await expect(tile).toContainText('+ trajet');
  await expect(page.getByTestId('trip-map')).toHaveAttribute('data-leg-lines', '0');

  await tile.getByRole('button', { name: 'Reprendre : Voiture 45 min' }).click();
  await expect(tile).toContainText('45 min');
  await expect(tile).toContainText('forcé');
});

test('fenêtre du trajet façon maquette : modes en boutons, couleur automatique puis choisie', async ({
  page,
}) => {
  await tripWithTwoSteps(page);
  await addPlaceViaMap(page, 'Eiffel', /Tour Eiffel/);

  const tiles = timeline(page).getByTestId('leg-tile');
  await expect(tiles).toHaveCount(2);
  for (const i of [0, 1]) {
    await tiles.nth(i).hover();
    await tiles.nth(i).getByRole('button', { name: 'Trajet en Voiture' }).click();
    await expect(tiles.nth(i)).toContainText('routeur');
  }
  // Couleur automatique : chaque trajet du jour prend la couleur suivante (tuile et carte).
  const line = (i: number) => tiles.nth(i).getByRole('button', { name: /Voiture|Vélo/ });
  await expect(line(0)).toHaveAttribute('style', /--leg-1\b/);
  await expect(line(1)).toHaveAttribute('style', /--leg-2\b/);
  const map = page.getByTestId('trip-map');
  await expect(map).toHaveAttribute('data-leg-colors', '--leg-1 --leg-2');

  await line(1).click();
  await page.getByTestId('leg-popup').getByRole('button', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier le trajet' });
  const modes = editor.getByRole('group', { name: 'Mode de transport' });
  await expect(modes.getByRole('radio')).toHaveCount(7);
  await expect(modes.getByRole('radio', { name: 'Voiture' })).toBeChecked();
  await expect(editor.getByRole('radio', { name: 'Automatique (Bleu)' })).toBeChecked();
  await modes.getByText('Vélo', { exact: true }).click();
  await editor.getByTitle('Rose').click();
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(editor).toHaveCount(0);

  await expect(tiles.nth(1)).toContainText('Vélo');
  await expect(line(1)).toHaveAttribute('style', /--leg-4\b/);
  await expect(map).toHaveAttribute('data-leg-colors', '--leg-1 --leg-4');
  // La popup du trajet prend aussi sa couleur.
  await line(1).click();
  await expect(page.getByTestId('leg-popup')).toHaveAttribute('style', /--leg-4\b/);
});

test('aucun itinéraire en train : saisie manuelle de la durée', async ({ page }) => {
  await tripWithTwoSteps(page);
  const tile = timeline(page).getByTestId('leg-tile');
  // Sans trajet, l'ajout n'apparaît qu'au survol de l'espace entre les lieux.
  await tile.hover();
  await tile.getByRole('button', { name: 'Trajet en Train' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau trajet' });
  await expect(dialog).toContainText('Aucun itinéraire trouvé');
  await dialog.getByLabel('Durée (min)').fill('35');
  await dialog.getByRole('button', { name: 'Ajouter le trajet' }).click();
  await expect(tile).toContainText('Train');
  await expect(tile).toContainText('35 min');
  await expect(tile).toContainText('forcé');
});

test('timeline compacte et trajets facultatifs : pas d’alerte, ajout au survol, trajet sur une ligne', async ({
  page,
}) => {
  await tripWithTwoSteps(page);
  const cards = timeline(page).getByTestId('step-card');
  const tile = timeline(page).getByTestId('leg-tile');
  const height = async (l: import('@playwright/test').Locator) =>
    (await l.boundingBox())?.height ?? 999;

  // Trajet facultatif : aucun signalement.
  await expect(page.getByText(/trajet manquant/)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /J1/ }).locator('.alert')).toHaveCount(0);

  // Carte d'étape sur une ligne.
  expect(await height(cards.first())).toBeLessThanOrEqual(48);
  // Sans trajet : l'ajout est replié, les deux cartes se suivent de près.
  const add = tile.getByRole('button', { name: 'Trajet en Voiture' });
  // L'opacité est portée par la barre d'ajout (« + trajet » et les modes).
  const bar = tile.locator('.reveal');
  await page.mouse.move(5, 5);
  await expect(bar).toHaveCSS('opacity', '0');
  const first = await cards.first().boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(second!.y - (first!.y + first!.height)).toBeLessThanOrEqual(24);
  // Survol de l'espace entre les lieux : l'ajout apparaît, sans décaler la liste.
  await tile.hover();
  await expect(bar).toHaveCSS('opacity', '1');
  expect((await cards.nth(1).boundingBox())!.y).toBe(second!.y);

  // Trajet existant : une ligne fine.
  await add.click();
  await expect(tile).toContainText('25 min');
  expect(await height(tile.getByRole('button', { name: /Voiture/ }))).toBeLessThanOrEqual(26);
});
