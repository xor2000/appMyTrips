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
  await context.route('https://*.tile.openstreetmap.fr/**', (route) => route.abort());
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
    explore.getByRole('group', { name: 'Lieux trouvés' }).getByRole('listitem'),
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
  await addPlaceViaMap(page, 'Louvre', /Musée du Louvre/);
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
  const list = explore.getByRole('group', { name: 'Lieux trouvés' });
  // Louvre (article Wikipédia) en tête, puis par distance au centre de la vue.
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByRole('listitem', { name: 'Musée du Louvre' })).toContainText(
    'Déjà ajouté',
  );
  await expect.poll(() => renderedPoiNames(page)).toHaveLength(3);
  await expect(
    explore.getByRole('group', { name: 'Catégories' }).getByRole('button', { name: /Musées/ }),
  ).toContainText('3');
  // Icône du type (musée) dessinée au centre de chaque pastille.
  await expect
    .poll(async () => (await renderedPois(page)).map((p) => [p.icon, p.iconReady]))
    .toEqual([
      ['poi-icon-museum', true],
      ['poi-icon-museum', true],
      ['poi-icon-museum', true],
    ]);

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
  // La carte se déplace : « Rechercher dans cette zone » apparaît et décale la liste sous la souris
  // restée immobile (le lieu passé dessous serait survolé). On l'éloigne de la liste.
  await page.mouse.move(640, 5);
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
  // Catégorie seule en couleur, icône à gauche du nom, source en petit sous l'adresse.
  await expect(popup.locator('.cat')).toHaveText('Musée');
  await expect(popup.getByRole('heading', { level: 4 }).locator('.type-icon svg')).toBeVisible();
  await expect(popup.locator('.source')).toHaveText('OpenStreetMap');
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

/** Zoom sur le Louvre (clic sur sa carte de la timeline) et attente de la fin du vol. */
async function zoomOnLouvre(page: Page) {
  await page
    .getByTestId('day-timeline')
    .getByTestId('step-card')
    .filter({ hasText: 'Musée du Louvre' })
    .getByRole('button', { name: /Musée du Louvre Musée/ })
    .click();
  await expect(page.getByTestId('step-popup')).toBeVisible();
  // Fin de l'animation : le Louvre est au centre de la carte, au zoom 15 au moins.
  await expect
    .poll(async () => {
      const zoom = await page.evaluate(() => (window as MapTestWindow).__mapZoomForTests?.() ?? 0);
      const center = await page.evaluate(() => {
        const p = (window as MapTestWindow).__mapProjectForTests?.([2.3376, 48.8606]);
        const canvas = document.querySelector<HTMLElement>('.maplibregl-canvas');
        return p && canvas
          ? Math.hypot(p.x - canvas.offsetWidth / 2, p.y - canvas.offsetHeight / 2)
          : 999;
      });
      return zoom >= 15 && center < 1;
    })
    .toBe(true);
}

test('fond OSM France : clic sur un lieu dessiné par le fond, popup et ajout aux idées', async ({
  page,
}) => {
  const poiRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/poi?')) poiRequests.push(r.url());
  });
  await tripCenteredOnLouvre(page);
  await zoomOnLouvre(page);

  // Fond « Plan » : ses lieux ne sont pas cliquables, aucune recherche.
  await clickMapAt(page, [2.333, 48.863]);
  await expect(page.getByTestId('step-popup')).toHaveCount(0);

  // Fond « Plan OSM France » : les lieux dessinés par les tuiles ouvrent la popup de la découverte.
  await page.getByRole('button', { name: 'Fond de carte' }).click();
  await page.getByRole('menuitemradio', { name: 'Plan OSM France' }).click();
  // Musée des Arts décoratifs (e2e/mock-services.mjs), sans passer par « Explorer ».
  await clickMapAt(page, [2.333, 48.863]);
  const popup = page.getByTestId('poi-popup');
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Musée des Arts décoratifs');
  await expect(popup.locator('.cat')).toHaveText('Musée');
  await expect(popup.locator('.source')).toHaveText('OpenStreetMap');
  await expect(popup).toContainText('107 Rue de Rivoli, Paris');
  await expect(popup.getByRole('button', { name: 'Ajouter à J1' })).toBeVisible();
  expect(poiRequests).toHaveLength(1);

  // Un autre lieu de la même zone : pas de nouvelle requête.
  await clickMapAt(page, [2.3405, 48.8622]);
  await expect(popup.getByRole('heading', { level: 4 })).toHaveText('Café Kitsuné');
  expect(poiRequests).toHaveLength(1);

  // Loin de tout lieu : rien ne s'ouvre.
  await clickMapAt(page, [2.3376, 48.8585]);
  await expect(popup).toHaveCount(0);

  await clickMapAt(page, [2.333, 48.863]);
  await popup.getByRole('button', { name: 'Ajouter aux idées' }).click();
  const ideas = page.getByRole('region', { name: 'Idées' });
  await expect(
    ideas.getByTestId('step-card').filter({ hasText: 'Musée des Arts décoratifs' }),
  ).toHaveCount(1);

  // Ajouté : le marqueur de l'idée recouvre le lieu du fond, son clic ouvre la popup de l'idée.
  await clickMapAt(page, [2.333, 48.863]);
  await expect(page.getByTestId('step-popup')).toContainText('Musée · Idée');
  await expect(popup).toHaveCount(0);
});

test('« Explorer la zone » : « Tous » lance une seule recherche, résultats groupés par catégorie', async ({
  page,
}) => {
  await tripCenteredOnLouvre(page);
  await page.getByRole('button', { name: 'Explorer la zone', exact: true }).click();
  const explore = page.getByRole('region', { name: 'Explorer' });
  const chips = explore.getByRole('group', { name: 'Catégories' });

  const searches: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/poi?')) searches.push(r.url());
  });
  await chips.getByRole('button', { name: 'Tous', exact: true }).click();
  const list = explore.getByRole('group', { name: 'Lieux trouvés' });
  await expect(list.getByRole('listitem')).toHaveCount(4);
  // Toutes les catégories cochées, en une seule requête.
  for (const button of await chips.getByRole('button').all()) {
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  expect(searches).toHaveLength(1);
  expect(new URL(searches[0]!).searchParams.get('categories')?.split(',')).toHaveLength(9);

  // Un titre par catégorie (icône, nombre), dans l'ordre des catégories : Cafés avant Musées.
  await expect(list.getByRole('heading', { level: 3 })).toHaveText([/Cafés\s*1/, /Musées\s*3/]);
  await expect(list.getByRole('listitem').first()).toContainText('Café Kitsuné');

  // « Tous » de nouveau : tout est décoché, plus de résultats.
  await chips.getByRole('button', { name: 'Tous', exact: true }).click();
  await expect(list).toHaveCount(0);
});
