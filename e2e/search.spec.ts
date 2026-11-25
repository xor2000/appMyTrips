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
  await context.route('https://*.tile.openstreetmap.fr/**', (route) => route.abort());
});

const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

/** Voyage de 3 jours avec le Louvre en J1 (référence OSM N1000 du faux Photon). */
async function tripWithLouvre(page: Page) {
  const name = uniqueName('Recherche');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
  await addPlaceViaMap(page, 'Louvre', /Musée du Louvre/);
  await expect(page.locator('.map-marker', { hasText: '1' })).toBeVisible();
}

const searchButton = (page: Page) => page.getByRole('button', { name: 'Rechercher', exact: true });

/** Ouvre « Rechercher » et saisit `query` ; renvoie le panneau. */
async function searchFor(page: Page, query: string) {
  await searchButton(page).click();
  const panel = page.getByRole('region', { name: 'Rechercher' });
  await panel.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill(query);
  return panel;
}

const menuOf = (page: Page, name: string) => page.getByRole('menu', { name, exact: true });

test('outils de la carte : Lieu, Explorer la zone et Rechercher alignés à gauche', async ({
  page,
}) => {
  await tripWithLouvre(page);
  // Plus de champ de recherche flottant.
  await expect(page.getByRole('button', { name: /Rechercher un lieu, une adresse/ })).toHaveCount(
    0,
  );
  const map = page.getByTestId('trip-map');
  const tools = map.getByRole('button', { name: /^(Lieu|Explorer la zone|Rechercher)$/ });
  await expect(tools).toHaveText(['Lieu', 'Explorer la zone', 'Rechercher']);
  const mapBox = (await map.boundingBox())!;
  const firstBox = (await tools.first().boundingBox())!;
  expect(firstBox.x - mapBox.x).toBeLessThan(40);
});

test('« Rechercher » : panneau gauche, résultats groupés par type, clic gauche : zoom et popup', async ({
  page,
}) => {
  await tripWithLouvre(page);
  const panel = await searchFor(page, 'ou');
  await expect(searchButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('searchbox')).toBeFocused();

  const results = panel.getByRole('group', { name: 'Résultats' });
  await expect(results.getByRole('heading', { level: 3 })).toHaveText([
    /^Musée\s*1/,
    /^Attraction\s*1/,
  ]);
  // Aucun bouton d'action sur les lignes ; le Louvre est déjà dans le voyage.
  await expect(results.getByRole('button', { name: /^Ajouter/ })).toHaveCount(0);
  await expect(results.getByRole('listitem', { name: 'Musée du Louvre' })).toContainText(
    'Déjà ajouté',
  );

  await results.getByRole('button', { name: /^Tour Eiffel/ }).click();
  const popup = page.getByTestId('poi-popup');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Tour Eiffel');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __mapZoomForTests: () => number }).__mapZoomForTests(),
      ),
    )
    .toBeGreaterThanOrEqual(15);
  await expect(results.getByRole('listitem', { name: 'Tour Eiffel' })).toHaveClass(/selected/);

  // « Explorer la zone » remplace « Rechercher » dans le même panneau.
  await page.getByRole('button', { name: 'Explorer la zone' }).click();
  await expect(page.getByRole('region', { name: 'Explorer' })).toBeVisible();
  await expect(panel).toHaveCount(0);
  await expect(searchButton(page)).toHaveAttribute('aria-pressed', 'false');

  // Retour au jour depuis « Rechercher ».
  await searchButton(page).click();
  await page
    .getByRole('region', { name: 'Rechercher' })
    .getByRole('button', { name: 'Retour au jour' })
    .click();
  await expect(page.getByTestId('day-timeline')).toBeVisible();
});

test('menu contextuel d’un résultat : idées, un jour, Google Maps, puis Supprimer', async ({
  page,
  context,
}) => {
  await context.route('https://www.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Google Maps</title>' }),
  );
  await tripWithLouvre(page);
  const panel = await searchFor(page, 'Eiffel');
  const item = panel.getByRole('listitem', { name: 'Tour Eiffel' });

  await item.click({ button: 'right' });
  const menu = menuOf(page, 'Tour Eiffel');
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Ajouter aux idées',
    'Ajouter à un jour',
    'Voir dans Google Maps',
  ]);

  // Google Maps : le point GPS dans un nouvel onglet.
  const tabPromise = context.waitForEvent('page');
  await menu.getByRole('menuitem', { name: 'Voir dans Google Maps' }).click();
  const tab = await tabPromise;
  expect(tab.url()).toContain('https://www.google.com/maps/search/?api=1&query=48.8584,2.2945');
  await tab.close();

  // Ajouter à J2, à la souris : le survol ouvre le sous-menu, qui reste ouvert pendant que le
  // pointeur traverse la marge du menu pour l'atteindre.
  await item.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Ajouter à un jour' }).hover();
  const j2 = page.getByRole('menu', { name: 'Ajouter à un jour' }).getByRole('menuitem', {
    name: /^J2/,
  });
  const box = (await j2.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await j2.click();
  await expect(item).toContainText('Déjà ajouté');

  // Déjà dans le voyage : Supprimer et Google Maps.
  await item.click({ button: 'right' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Supprimer', 'Voir dans Google Maps']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  // Ajouter aux idées.
  await panel.getByRole('searchbox').fill('Orsay');
  const orsay = panel.getByRole('listitem', { name: 'Musée d’Orsay' });
  await orsay.click({ button: 'right' });
  await menuOf(page, 'Musée d’Orsay').getByRole('menuitem', { name: 'Ajouter aux idées' }).click();
  await expect(orsay).toContainText('Déjà ajouté');

  await panel.getByRole('button', { name: 'Retour au jour' }).click();
  await expect(page.getByRole('region', { name: 'Idées' }).getByTestId('step-card')).toContainText([
    'Musée d’Orsay',
  ]);
  await page.getByRole('tab', { name: /J2/ }).click();
  await expect(page.getByTestId('day-timeline')).toContainText('Tour Eiffel');

  // Supprimer depuis le menu (confirmé).
  await searchFor(page, 'Eiffel');
  await page
    .getByRole('region', { name: 'Rechercher' })
    .getByRole('listitem', { name: 'Tour Eiffel' })
    .click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Supprimer' }).click();
  await page
    .getByRole('alertdialog', { name: 'Supprimer l’étape ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Rechercher' }).getByRole('listitem', { name: 'Tour Eiffel' }),
  ).not.toContainText('Déjà ajouté');
});

test('plein écran (mode Carte) : le panneau « Rechercher » ne masque pas les outils', async ({
  page,
}) => {
  await tripWithLouvre(page);
  await page.getByRole('button', { name: 'Plein écran' }).click();
  await page
    .getByRole('group', { name: 'Plein écran' })
    .getByRole('button', { name: 'Carte' })
    .click();
  const panel = await searchFor(page, 'Eiffel');
  await expect(panel.getByRole('listitem', { name: 'Tour Eiffel' })).toBeVisible();
  const panelBox = (await panel.boundingBox())!;
  const toolBox = (await searchButton(page).boundingBox())!;
  expect(toolBox.x).toBeGreaterThanOrEqual(panelBox.x + panelBox.width);
});
