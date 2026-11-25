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

/** Voyage de trois jours avec le Louvre et Orsay sur J1 (services factices). */
async function tripWithTwoPlaces(page: Page) {
  const name = uniqueName('Menu');
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

const timelineCard = (page: Page, name: string) =>
  page.getByTestId('day-timeline').getByTestId('step-card').filter({ hasText: name });
const ideas = (page: Page) => page.getByRole('region', { name: 'Idées' });
const menuOf = (page: Page, name: string) => page.getByRole('menu', { name, exact: true });

test('survol d’un lieu ou d’un séjour (jour, idées, métro) : rien n’est mis en évidence', async ({
  page,
}) => {
  await tripWithTwoPlaces(page);
  const louvre = timelineCard(page, 'Musée du Louvre');
  const orsay = timelineCard(page, 'Musée d’Orsay');
  const louvreMarker = page.locator('.map-marker', { hasText: '1' });
  const orsayMarker = page.locator('.map-marker', { hasText: '2' });

  // Le survol d'un marqueur met toujours le lieu en évidence dans la liste (sens carte → liste).
  await orsayMarker.hover();
  await expect(orsay).toHaveClass(/highlighted/);
  await page.mouse.move(5, 5);
  await expect(orsay).not.toHaveClass(/highlighted/);

  // Lieu d'un jour : ni la carte du lieu ni son marqueur ne sont mis en évidence.
  await orsay.hover();
  await expect(orsay).not.toHaveClass(/highlighted/);
  await expect(orsayMarker).not.toHaveClass(/highlighted/);

  // Séjour d'un jour.
  await page.getByRole('button', { name: 'Lieu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Hôtel des Arts');
  await dialog.getByRole('button', { name: /Hôtel des Arts/ }).click();
  const form = page.getByRole('dialog', { name: 'Nouveau lieu' });
  await form.getByText('Séjour', { exact: true }).click();
  await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const stay = page.getByTestId('day-timeline').getByTestId('stay-card');
  await expect(stay).toHaveCount(1);
  await stay.hover();
  await expect(stay).not.toHaveClass(/highlighted/);

  // Idée.
  await orsay.click({ button: 'right' });
  await menuOf(page, 'Musée d’Orsay').getByRole('menuitem', { name: 'Déplacer vers' }).click();
  await page
    .getByRole('menu', { name: 'Déplacer vers' })
    .getByRole('menuitem', { name: /^Idées/ })
    .click();
  const idea = ideas(page).getByTestId('step-card').filter({ hasText: 'Musée d’Orsay' });
  await idea.hover();
  await expect(idea).not.toHaveClass(/highlighted/);
  await expect(page.locator('.map-marker.idea')).not.toHaveClass(/highlighted/);

  // Station de la ligne de métro.
  await page.mouse.move(5, 5);
  await expect(louvre).toBeVisible();
  await page.getByRole('button', { name: 'Ligne de métro' }).click();
  const stop = page.getByTestId('metro-stop').filter({ hasText: 'Musée du Louvre' });
  await stop.hover();
  await expect(stop).not.toHaveClass(/highlighted/);
  await expect(louvreMarker).not.toHaveClass(/highlighted/);
});

test('clic droit sur un lieu : menu contextuel, déplacement vers les idées et annulation', async ({
  page,
}) => {
  await tripWithTwoPlaces(page);
  await timelineCard(page, 'Musée d’Orsay').click({ button: 'right' });
  const menu = menuOf(page, 'Musée d’Orsay');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Modifier',
    'Supprimer',
    'Déplacer vers',
    'Voir dans Google Maps',
  ]);
  // Plus d'actions au survol sur la carte du lieu.
  await expect(page.getByRole('button', { name: /^(Monter|Descendre|Supprimer) / })).toHaveCount(0);

  await menu.getByRole('menuitem', { name: 'Déplacer vers' }).click();
  const targets = page.getByRole('menu', { name: 'Déplacer vers' });
  // Le jour où se trouve le lieu (J1) n'est pas proposé.
  await expect(targets.getByRole('menuitem')).toHaveText([/^Idées/, /^J2/, /^J3/]);
  await targets.getByRole('menuitem', { name: /^Idées/ }).click();
  await expect(menu).toHaveCount(0);
  await expect(ideas(page).getByTestId('step-card')).toContainText(['Musée d’Orsay']);
  await expect(timelineCard(page, 'Musée d’Orsay')).toHaveCount(0);

  // Ctrl+Z : retour dans J1.
  await page.locator('body').press('Control+z');
  await expect(timelineCard(page, 'Musée d’Orsay')).toHaveCount(1);
  await expect(ideas(page).getByTestId('step-card')).toHaveCount(0);
});

test('menu contextuel : Modifier, Supprimer (confirmé) et Voir dans Google Maps', async ({
  page,
  context,
}) => {
  await context.route('https://www.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Google Maps</title>' }),
  );
  await tripWithTwoPlaces(page);

  await timelineCard(page, 'Musée du Louvre').click({ button: 'right' });
  await menuOf(page, 'Musée du Louvre').getByRole('menuitem', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Annuler' }).click();

  await timelineCard(page, 'Musée du Louvre').click({ button: 'right' });
  await menuOf(page, 'Musée du Louvre').getByRole('menuitem', { name: 'Supprimer' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Supprimer l’étape ?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Annuler' }).click();
  await expect(timelineCard(page, 'Musée du Louvre')).toHaveCount(1);

  // Google Maps : le point GPS dans un nouvel onglet.
  await timelineCard(page, 'Musée du Louvre').click({ button: 'right' });
  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    menuOf(page, 'Musée du Louvre')
      .getByRole('menuitem', { name: 'Voir dans Google Maps' })
      .click(),
  ]);
  await expect
    .poll(() => tab.url())
    .toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-?\d+\.\d+,-?\d+\.\d+$/);
  // Le menu se ferme ; Échap aussi le ferme.
  await expect(menuOf(page, 'Musée du Louvre')).toHaveCount(0);
  await timelineCard(page, 'Musée du Louvre').click({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(menuOf(page, 'Musée du Louvre')).toHaveCount(0);
});

test('clic droit sur un marqueur, une idée, un dossier : même menu ; icône de catégorie des idées', async ({
  page,
}) => {
  await tripWithTwoPlaces(page);

  // Marqueur de la carte : le menu du lieu, pas la popup du lieu le plus proche (Photon).
  await page.locator('.map-marker', { hasText: '2' }).click({ button: 'right' });
  const menu = menuOf(page, 'Musée d’Orsay');
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('poi-popup')).toHaveCount(0);

  // Orsay devient une idée : son marqueur porte l'icône de sa catégorie, plus l'ampoule.
  await menu.getByRole('menuitem', { name: 'Déplacer vers' }).click();
  await page
    .getByRole('menu', { name: 'Déplacer vers' })
    .getByRole('menuitem', { name: /^Idées/ })
    .click();
  const ideaMarker = page.locator('.map-marker.idea');
  await expect(ideaMarker).toHaveAttribute('data-icon', 'museum');
  await expect(ideaMarker.locator('svg')).toHaveCount(1);

  // Clic droit sur l'idée : tous les jours, pas « Idées ».
  await ideas(page).getByTestId('step-card').click({ button: 'right' });
  await menuOf(page, 'Musée d’Orsay').getByRole('menuitem', { name: 'Déplacer vers' }).click();
  await expect(page.getByRole('menu', { name: 'Déplacer vers' }).getByRole('menuitem')).toHaveText([
    /^J1/,
    /^J2/,
    /^J3/,
  ]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Dossier : Modifier, Supprimer, Déplacer vers, sans Google Maps.
  await page.getByRole('button', { name: 'Nouveau dossier', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau dossier' });
  await dialog.getByLabel('Nom du dossier').fill('Rive gauche');
  await dialog.getByRole('button', { name: 'Créer le dossier' }).click();
  await page
    .getByTestId('group-card')
    .filter({ hasText: 'Rive gauche' })
    .getByRole('button', { name: /Rive gauche/ })
    .last()
    .click({ button: 'right' });
  await expect(menuOf(page, 'Rive gauche').getByRole('menuitem')).toHaveText([
    'Modifier',
    'Supprimer',
    'Déplacer vers',
  ]);
});

test('ligne de métro : clic droit sur une station, plus de flèches plus tôt / plus tard', async ({
  page,
}) => {
  await tripWithTwoPlaces(page);
  await page.getByRole('button', { name: 'Ligne de métro' }).click();
  const stop = page.getByTestId('metro-stop').filter({ hasText: 'Musée du Louvre' });
  await stop.hover();
  await expect(page.getByRole('button', { name: /^Plus (tôt|tard) :/ })).toHaveCount(0);
  await stop.click({ button: 'right' });
  const menu = menuOf(page, 'Musée du Louvre');
  await menu.getByRole('menuitem', { name: 'Déplacer vers' }).click();
  await page
    .getByRole('menu', { name: 'Déplacer vers' })
    .getByRole('menuitem', { name: /^J2/ })
    .click();
  await expect(page.getByTestId('metro-stop')).toHaveCount(1);
  await expect(page.getByTestId('metro-stop')).toContainText('Musée d’Orsay');
});
