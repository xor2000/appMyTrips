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
  await expect(page.locator('.poi-marker')).toHaveCount(3);
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
  await expect(page.locator('.poi-marker')).toHaveCount(0);

  await card.getByRole('button', { name: /Musée des Arts décoratifs Musée/ }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await expect(editor.getByLabel('Type')).toHaveValue('museum');
  await expect(editor.getByLabel('Horaires d’ouverture')).toHaveValue('Tu-Su 11:00-18:00');
  await expect(editor.getByLabel('Notes')).toHaveValue('Site : https://madparis.fr');
});

test('trop loin : la découverte invite à zoomer', async ({ page }) => {
  await tripCenteredOnLouvre(page);
  await page.getByRole('button', { name: 'Explorer' }).click();
  const explore = page.getByRole('region', { name: 'Explorer' });
  await expect(explore.getByText('Zoomez pour explorer')).toHaveCount(0);

  // Dézoomer de 13 à 11.
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
