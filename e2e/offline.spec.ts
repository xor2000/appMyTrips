import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Style minimal avec une source vectorielle, pour que « Préparer hors ligne » trouve le modèle
 * d'URL des tuiles (style → TileJSON → tuiles). Tuiles, sprites et polices sont simulés.
 */
const STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#dfe9e4' } }],
};

async function fakeTiles(context: BrowserContext) {
  await context.route('https://tiles.openfreemap.org/**', (route) => {
    const url = route.request().url();
    if (url.includes('/styles/')) return route.fulfill({ json: STYLE });
    if (url.endsWith('/planet')) {
      return route.fulfill({
        json: { tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'] },
      });
    }
    return route.fulfill({ body: 'tuile', contentType: 'application/x-protobuf' });
  });
  await context.route('https://*.tile.opentopomap.org/**', (route) => route.abort());
}

const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

/** Attend que le service worker contrôle la page (il ne prend la main qu'au chargement suivant). */
async function controlledBySw(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('préparer un voyage hors ligne, le consulter sans réseau, puis retrouver l’édition', async ({
  page,
  context,
}) => {
  // Parcours long (création, préparation, hors ligne, retour en ligne) : plus que les 30 s par défaut.
  test.setTimeout(90_000);
  await fakeTiles(context);
  await page.goto('/');
  await controlledBySw(page);

  const name = uniqueName('Hors ligne');
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
  await expect(add).toHaveCount(0);

  // Préparer hors ligne : tuiles de la zone préchargées, instantané gardé.
  await page.getByRole('button', { name: 'Préparer hors ligne' }).click();
  const offline = page.getByRole('dialog', { name: 'Préparer hors ligne' });
  await expect(offline).toContainText(/tuiles · environ \d+ Mo/);
  await offline.getByRole('button', { name: 'Préparer' }).click();
  await expect(offline).toContainText('Disponible hors ligne', { timeout: 30_000 });
  await offline.getByRole('button', { name: 'Fermer', exact: true }).click();

  // Sans réseau : l'application s'ouvre, le voyage s'affiche en lecture seule.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Hors ligne' })).toContainText(
    /Hors ligne · consultation seule · données du \d\d\/\d\d à \d\d:\d\d/,
  );
  await page.getByRole('tab', { name: /J1/ }).click();
  await expect(page.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' })).toContainText(
    '08:00 → 10:00',
  );
  await expect(page.getByRole('button', { name: 'Ajouter un lieu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Paramètres du voyage' })).toHaveCount(0);

  // « / » rouvre ce voyage depuis la copie ; la liste de l'en-tête le propose, sans création.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('combobox', { name: 'Choisir un voyage' }).click();
  await expect(
    page.getByRole('listbox', { name: 'Voyages' }).getByRole('option', { name, exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nouveau voyage' })).toHaveCount(0);

  // Retour du réseau : l'édition revient.
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Nouveau voyage' })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
  await expect(page.getByRole('button', { name: 'Ajouter un lieu' })).toBeVisible();
});
