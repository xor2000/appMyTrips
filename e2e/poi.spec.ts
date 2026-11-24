import { expect, test, type Page } from '@playwright/test';
import { clickMapAt, type MapTestWindow } from './map-helpers';

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

/** Lieux de la découverte dessinés sur la carte (vides tant que la carte n'est pas prête). */
const renderedPois = (page: Page) =>
  page.evaluate(() => (window as MapTestWindow).__mapPoisForTests?.() ?? []);

const renderedPoiNames = async (page: Page) => (await renderedPois(page)).map((p) => p.name).sort();

async function exploreMuseums(page: Page) {
  await page.getByRole('button', { name: 'Explorer' }).click();
  const explore = page.getByRole('region', { name: 'Explorer' });
  await explore
    .getByRole('group', { name: 'Catégories' })
    .getByRole('button', { name: /Musées/ })
    .click();
  await expect(
    explore.getByRole('list', { name: 'Lieux trouvés' }).getByRole('listitem'),
  ).toHaveCount(3);
  return explore;
}

/**
 * Voyage de 3 jours avec le Louvre en J1 : la carte se centre dessus (zoom 13, assez près pour
 * explorer). Les lieux viennent du faux Overpass (e2e/mock-services.mjs).
 */
async function tripCenteredOnLouvre(page: Page) {
  const name = uniqueName('Découverte');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
  await page.getByRole('button', { name: 'Ajouter un lieu' }).click();
  const add = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await add.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Louvre');
  await add.getByRole('button', { name: /Musée du Louvre/ }).click();
  await expect(page.locator('.map-marker', { hasText: '1' })).toBeVisible();
}

test('explorer les musées de la zone et en ajouter un à J2, avec ses horaires', async ({
  page,
}) => {
  await tripCenteredOnLouvre(page);
  await page.getByRole('tab', { name: /J2/ }).click();
  await page.getByRole('button', { name: 'Explorer' }).click();

  const explore = page.getByRole('region', { name: 'Explorer' });
  await explore
    .getByRole('group', { name: 'Catégories' })
    .getByRole('button', { name: /Musées/ })
    .click();
  const list = explore.getByRole('list', { name: 'Lieux trouvés' });
  // Louvre (article Wikipédia) en tête, puis par distance au centre de la vue.
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByRole('listitem', { name: 'Musée du Louvre' })).toContainText(
    'Déjà ajouté',
  );
  await expect.poll(() => renderedPoiNames(page)).toHaveLength(3);
  await expect(
    explore.getByRole('group', { name: 'Catégories' }).getByRole('button', { name: /Musées/ }),
  ).toContainText('3');

  await explore.getByRole('button', { name: 'Ajouter Musée des Arts décoratifs à J2' }).click();
  await expect(list.getByRole('listitem', { name: 'Musée des Arts décoratifs' })).toContainText(
    'Déjà ajouté',
  );

  await explore.getByRole('button', { name: 'Retour au jour' }).click();
  const card = page
    .getByTestId('day-timeline')
    .getByTestId('step-card')
    .filter({ hasText: 'Musée des Arts décoratifs' });
  await expect(card).toContainText('Musée · 2 h sur place');
  await expect.poll(() => renderedPoiNames(page)).toEqual([]);

  await card.getByRole('button', { name: /Musée des Arts décoratifs Musée/ }).click();
  await page.getByTestId('step-popup').getByRole('button', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await expect(editor.getByRole('radio', { name: 'Musée', exact: true })).toBeChecked();
  await expect(editor.getByLabel('Horaires d’ouverture')).toHaveValue('Tu-Su 11:00-18:00');
  await expect(editor.getByLabel('Notes')).toHaveValue('Site : https://madparis.fr');
});

test('trop loin : la découverte invite à zoomer', async ({ page }) => {
  await tripCenteredOnLouvre(page);
  await page.getByRole('button', { name: 'Explorer' }).click();
  const explore = page.getByRole('region', { name: 'Explorer' });
  await expect(explore.getByText('Zoomez pour explorer')).toHaveCount(0);

  // Dézoomer de 13 à 11, une fois le cadrage sur le Louvre terminé (un clic pendant l'animation
  // serait annulé par elle).
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __mapZoomForTests: () => number }).__mapZoomForTests(),
      ),
    )
    .toBeCloseTo(13, 1);
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  await zoomOut.click();
  await zoomOut.click();
  await expect(explore.getByText('Zoomez pour explorer')).toBeVisible();
});

test('la carte a bougé : relancer la recherche dans la nouvelle zone', async ({ page }) => {
  await tripCenteredOnLouvre(page);
  await page.getByRole('button', { name: 'Explorer' }).click();
  const explore = page.getByRole('region', { name: 'Explorer' });
  await explore
    .getByRole('group', { name: 'Catégories' })
    .getByRole('button', { name: /Cafés/ })
    .click();
  await expect(explore.getByRole('listitem', { name: 'Café Kitsuné' })).toBeVisible();
  await expect(explore.getByRole('button', { name: 'Rechercher dans cette zone' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await explore.getByRole('button', { name: 'Rechercher dans cette zone' }).click();
  await expect(explore.getByRole('button', { name: 'Rechercher dans cette zone' })).toHaveCount(0);
});

test('choisir un lieu dans la liste le met en évidence sur la carte, avec son nom', async ({
  page,
}) => {
  await tripCenteredOnLouvre(page);
  const explore = await exploreMuseums(page);
  await expect.poll(() => renderedPoiNames(page)).toHaveLength(3);

  await explore
    .getByRole('listitem', { name: 'Musée des Arts décoratifs' })
    .getByRole('button', { name: /Musée des Arts décoratifs/ })
    .first()
    .click();
  const popup = page.getByTestId('poi-popup');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Musée des Arts décoratifs');
  await expect
    .poll(async () => (await renderedPois(page)).filter((p) => p.active).map((p) => p.name))
    .toEqual(['Musée des Arts décoratifs']);
  // Zoom sur le lieu (15 au moins), comme la référence.
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __mapZoomForTests: () => number }).__mapZoomForTests(),
      ),
    )
    .toBeGreaterThanOrEqual(15);

  // Fermer la popup désélectionne le lieu.
  await page.locator('.map-popup .maplibregl-popup-close-button').click();
  await expect(popup).toHaveCount(0);
  await expect
    .poll(async () => (await renderedPois(page)).filter((p) => p.active).map((p) => p.name))
    .toEqual([]);
});

test('popup d’un lieu découvert : type, source, Ajouter, puis « Déjà ajouté » et Supprimer', async ({
  page,
}) => {
  await tripCenteredOnLouvre(page);
  const explore = await exploreMuseums(page);
  const item = explore.getByRole('listitem', { name: 'Musée des Arts décoratifs' });
  await item
    .getByRole('button', { name: /Musée des Arts décoratifs/ })
    .first()
    .click();
  const popup = page.getByTestId('poi-popup');
  await expect(popup).toContainText('Musée · OpenStreetMap');
  await expect(popup.getByRole('button', { name: 'Ajouter aux idées' })).toBeVisible();
  await popup.getByRole('button', { name: 'Ajouter à J1' }).click();
  await expect(item).toContainText('Déjà ajouté');

  await item
    .getByRole('button', { name: /Musée des Arts décoratifs/ })
    .first()
    .click();
  await expect(popup).toContainText('Déjà ajouté');
  await expect(popup.getByRole('button', { name: /^Ajouter/ })).toHaveCount(0);
  await popup.getByRole('button', { name: 'Supprimer' }).click();
  await page
    .getByRole('alertdialog', { name: 'Supprimer l’étape ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(item).not.toContainText('Déjà ajouté');
});

test('cliquer un lieu sur la carte le sélectionne dans la liste', async ({ page }) => {
  await tripCenteredOnLouvre(page);
  const explore = await exploreMuseums(page);
  await expect.poll(() => renderedPoiNames(page)).toHaveLength(3);

  // Musée des Arts décoratifs (e2e/mock-services.mjs).
  await clickMapAt(page, [2.333, 48.863]);
  await expect(page.getByTestId('poi-popup').getByRole('heading', { level: 4 })).toHaveText(
    'Musée des Arts décoratifs',
  );
  await expect(
    explore
      .getByRole('listitem', { name: 'Musée des Arts décoratifs' })
      .getByRole('button', { expanded: true }),
  ).toBeVisible();
});

test('les marqueurs d’étapes suivent la carte sans animer leur position', async ({ page }) => {
  await tripCenteredOnLouvre(page);
  // MapLibre place un marqueur par `transform` : une transition sur cette propriété le ferait
  // traîner derrière la carte pendant un déplacement.
  const transitioned = await page
    .locator('.map-marker', { hasText: '1' })
    .evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(transitioned).not.toMatch(/\b(transform|all)\b/);
});

test('taille d’affichage à 80 % : un clic sur la carte vise toujours le bon lieu', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('mytrips.scale', '80'));
  await tripCenteredOnLouvre(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe('0.8');
  await exploreMuseums(page);
  await expect.poll(() => renderedPoiNames(page)).toHaveLength(3);
  await clickMapAt(page, [2.333, 48.863]);
  await expect(page.getByTestId('poi-popup').getByRole('heading', { level: 4 })).toHaveText(
    'Musée des Arts décoratifs',
  );
});
