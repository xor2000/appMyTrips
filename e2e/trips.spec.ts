import { expect, test, type Page } from '@playwright/test';
import { anonymousContext, signupViaUi, uniqueEmail } from './auth-helpers';

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

/** Nom de voyage unique : la base D1 locale des e2e est conservée d'une exécution à l'autre. */
const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function createTrip(page: Page, name: string, start = '2026-07-10', end = '2026-07-12') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill(start);
  await dialog.getByLabel('Au', { exact: true }).fill(end);
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('créer un voyage, le retrouver dans la liste de l’en-tête', async ({ page }) => {
  const name = uniqueName('Alpes');
  await createTrip(page, name);

  // Page voyage : onglets des jours et carte.
  await expect(page.getByText('10 – 12 juillet 2026')).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveText([/Tout le voyage/, /J1/, /J2/, /J3/]);
  await page.getByRole('tab', { name: /J2/ }).click();
  await expect(page.getByRole('tab', { name: /J2/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();

  // Le voyage est choisi dans la liste déroulante de l'en-tête.
  const select = page.getByRole('combobox', { name: 'Choisir un voyage' });
  await expect(select).toContainText(name);
});

test('beaucoup de jours : pas de barre de défilement, des flèches pour avancer dans les jours', async ({
  page,
}) => {
  await createTrip(page, uniqueName('Long séjour'), '2026-07-01', '2026-08-14');
  const tablist = page.getByRole('tablist', { name: 'Jours du voyage' });
  const first = tablist.getByRole('tab', { name: /^J1 / });
  const last = tablist.getByRole('tab', { name: /^J45 / });
  const prev = page.getByTitle('Jours précédents');
  const next = page.getByTitle('Jours suivants');

  // Barre de défilement masquée sur le conteneur des jours.
  const scrollbar = await first.evaluate(
    (tab) => getComputedStyle(tab.parentElement!).scrollbarWidth,
  );
  expect(scrollbar).toBe('none');

  // Flèches de part et d'autre des jours : rien avant le premier jour au départ.
  await expect(prev).toBeVisible();
  await expect(next).toBeVisible();
  await expect(prev).toBeDisabled();
  const prevBox = await prev.boundingBox();
  const firstBox = await first.boundingBox();
  const allBox = await tablist.getByRole('tab', { name: /Tout le voyage/ }).boundingBox();
  expect(allBox!.x).toBeLessThan(prevBox!.x);
  expect(prevBox!.x + prevBox!.width).toBeLessThanOrEqual(firstBox!.x + 1);
  await expect(last).not.toBeInViewport();

  // Avancer jusqu'au dernier jour.
  await next.click();
  await expect(prev).toBeEnabled();
  await expect(first).not.toBeInViewport();
  for (let i = 0; i < 20 && (await next.isEnabled()); i++) {
    await next.click();
    await page.waitForTimeout(150);
  }
  await expect(next).toBeDisabled();
  await expect(last).toBeInViewport();
  const nextBox = await next.boundingBox();
  const lastBox = await last.boundingBox();
  expect(lastBox!.x + lastBox!.width).toBeLessThanOrEqual(nextBox!.x + 1);

  // Revenir en arrière, puis choisir un jour.
  await prev.click();
  await expect(next).toBeEnabled();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(last).toHaveAttribute('aria-selected', 'true');
});

test('peu de jours : aucune flèche de défilement', async ({ page }) => {
  await createTrip(page, uniqueName('Court séjour'));
  await expect(page.getByRole('tab', { name: /J3/ })).toBeVisible();
  await expect(page.getByTitle('Jours suivants')).toHaveCount(0);
  await expect(page.getByTitle('Jours précédents')).toHaveCount(0);
});

test('la carte charge son web worker sans erreur', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await createTrip(page, uniqueName('Carte'));
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  // Le worker MapLibre est chargé de façon asynchrone après l'initialisation de la carte.
  await page.waitForTimeout(1500);
  expect(errors.filter((e) => /worker|MIME type/i.test(e))).toEqual([]);
});

test('la carte n’affiche pas d’avertissement pour les icônes absentes ni les propriétés manquantes', async ({
  page,
}) => {
  // Reproduit les deux défauts du style Liberty d'OpenFreeMap : panneau de route filtré sur une
  // propriété absente (`ref_length`) et icône de lieu absente du sprite.
  await page.route('https://tiles.openfreemap.org/styles/**', (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {
          test: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [2, 45],
                      [14, 49],
                    ],
                  },
                },
                {
                  type: 'Feature',
                  properties: { class: 'sports_centre' },
                  geometry: { type: 'Point', coordinates: [8, 47] },
                },
              ],
            },
          },
        },
        layers: [
          { id: 'fond', type: 'background', paint: { 'background-color': '#dfe9e4' } },
          {
            id: 'bouclier',
            type: 'line',
            source: 'test',
            filter: ['<=', ['get', 'ref_length'], 6],
          },
          {
            id: 'lieu',
            type: 'symbol',
            source: 'test',
            filter: ['==', ['geometry-type'], 'Point'],
            layout: { 'icon-image': ['get', 'class'] },
          },
        ],
      },
    }),
  );
  const warnings: string[] = [];
  const collect = (text: string) => {
    if (/Expected value to be of type|could not be loaded/.test(text)) warnings.push(text);
  };
  page.on('console', (msg) => collect(msg.text()));
  page.on('worker', (worker) => worker.on('console', (msg) => collect(msg.text())));

  await createTrip(page, uniqueName('Avertissements'));
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  // Les filtres sont évalués dans le web worker, après le chargement asynchrone du style.
  await page.waitForTimeout(2000);
  expect([...new Set(warnings)]).toEqual([]);
});

test('modifier la période ajoute les jours', async ({ page }) => {
  const name = uniqueName('Période');
  await createTrip(page, name);
  await page.getByRole('button', { name: 'Paramètres du voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le voyage' });
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-13');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('tab')).toHaveText([/Tout le voyage/, /J1/, /J2/, /J3/, /J4/]);
  await expect(page.getByText('10 – 13 juillet 2026')).toBeVisible();
});

test('partager en lecture seule : l’invité voit le voyage sans pouvoir le modifier', async ({
  page,
  browser,
}) => {
  const name = uniqueName('Partagé');
  await createTrip(page, name);
  await page.getByRole('button', { name: 'Partager' }).click();
  const dialog = page.getByRole('dialog', { name: /partager/i });
  await dialog.getByLabel('Rôle de l’invité').selectOption('viewer');
  await dialog.getByRole('button', { name: 'Créer un lien' }).click();
  const link = await dialog.getByLabel('Lien d’invitation').inputValue();
  expect(link).toMatch(/\/invitation\/[\w-]+$/);
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();

  // Bob, sans compte, ouvre le lien dans un autre contexte : connexion demandée, il s'inscrit,
  // revient sur l'invitation et l'accepte.
  const bob = await anonymousContext(browser);
  await bob.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({ json: EMPTY_STYLE }),
  );
  const invited = await bob.newPage();
  await invited.goto(new URL(link).pathname);
  await expect(invited).toHaveURL(/\/connexion\?suite=/);
  const bobEmail = uniqueEmail('bob');
  await signupViaUi(invited, bobEmail);
  await expect(invited.getByText(name)).toBeVisible();
  await invited.getByRole('button', { name: 'Rejoindre le voyage' }).click();
  await expect(invited.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(invited.getByText('Lecture seule')).toBeVisible();

  // Le propriétaire voit Bob parmi les membres.
  await page.reload();
  await page.getByRole('button', { name: 'Partager' }).click();
  await expect(page.getByRole('dialog', { name: /partager/i }).getByText(bobEmail)).toBeVisible();

  const bobPage = await bob.newPage();
  // « / » rouvre le dernier voyage consulté : celui qui vient d'être rejoint.
  await bobPage.goto('/');
  await expect(bobPage.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(bobPage.getByText('Lecture seule')).toBeVisible();
  await expect(bobPage.getByRole('button', { name: 'Paramètres du voyage' })).toHaveCount(0);
  await expect(bobPage.getByRole('button', { name: 'Partager' })).toHaveCount(0);
  await bob.close();
});

test('supprimer un voyage après confirmation', async ({ page }) => {
  const name = uniqueName('À supprimer');
  await createTrip(page, name);
  const tripUrl = page.url();
  await page.getByRole('button', { name: 'Paramètres du voyage' }).click();
  await page
    .getByRole('dialog', { name: 'Modifier le voyage' })
    .getByRole('button', { name: 'Supprimer le voyage' })
    .click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(name);
  await confirm.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page).not.toHaveURL(tripUrl);
  // Retiré de la liste de l'en-tête (absente s'il ne reste aucun voyage).
  const switcher = page.getByRole('combobox', { name: 'Choisir un voyage' });
  await expect(
    switcher.or(page.getByRole('heading', { name: 'Aucun voyage pour l’instant' })),
  ).toBeVisible();
  if (await switcher.isVisible()) {
    await switcher.click();
    await expect(page.getByRole('listbox', { name: 'Voyages' })).toBeVisible();
    await expect(page.getByRole('option', { name, exact: true })).toHaveCount(0);
  }
});

test('un voyage inconnu affiche un message clair', async ({ page }) => {
  await page.goto('/trips/3f0fa7bf-e95b-4fee-ab08-b30a6385734f');
  await expect(page.getByText('Voyage introuvable')).toBeVisible();
});
