import { expect, test, type Page } from '@playwright/test';

const BOB = 'bob@example.test';

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

test('créer un voyage, le retrouver dans la liste et l’ouvrir', async ({ page }) => {
  const name = uniqueName('Alpes');
  await createTrip(page, name);

  // Page voyage : onglets des jours et carte.
  await expect(page.getByText('10 – 12 juillet 2026')).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveText(['Tout le voyage', /J1/, /J2/, /J3/]);
  await page.getByRole('tab', { name: /J2/ }).click();
  await expect(page.getByRole('tab', { name: /J2/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();

  // Retour à la liste.
  await page.getByRole('link', { name: 'Retour aux voyages' }).click();
  const card = page.getByRole('article').filter({ hasText: name });
  await expect(card).toContainText('3 jours');
  await card.getByRole('link', { name: /ouvrir le carnet/i }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
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

test('modifier la période ajoute les jours', async ({ page }) => {
  const name = uniqueName('Période');
  await createTrip(page, name);
  await page.getByRole('button', { name: 'Modifier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le voyage' });
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-13');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('tab')).toHaveText(['Tout le voyage', /J1/, /J2/, /J3/, /J4/]);
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
  await dialog.getByLabel('E-mail').fill(BOB);
  await dialog.getByLabel('Rôle').selectOption('viewer');
  await dialog.getByRole('button', { name: 'Inviter' }).click();
  await expect(dialog.getByText(BOB)).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer' }).click();

  // Bob, dans un autre contexte de navigateur (en-tête de dev x-dev-user-email).
  const bob = await browser.newContext({ extraHTTPHeaders: { 'x-dev-user-email': BOB } });
  await bob.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({ json: EMPTY_STYLE }),
  );
  const bobPage = await bob.newPage();
  await bobPage.goto('/');
  const card = bobPage.getByRole('article').filter({ hasText: name });
  await expect(card).toContainText('Partagé · lecture');
  await expect(card.getByRole('button', { name: /supprimer/i })).toHaveCount(0);
  await card.getByRole('link', { name: /ouvrir le carnet/i }).click();
  await expect(bobPage.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(bobPage.getByText('Lecture seule')).toBeVisible();
  await expect(bobPage.getByRole('button', { name: 'Modifier' })).toHaveCount(0);
  await expect(bobPage.getByRole('button', { name: 'Partager' })).toHaveCount(0);
  await bob.close();
});

test('supprimer un voyage après confirmation', async ({ page }) => {
  const name = uniqueName('À supprimer');
  await createTrip(page, name);
  await page.getByRole('link', { name: 'Retour aux voyages' }).click();
  const card = page.getByRole('article').filter({ hasText: name });
  await card.getByRole('button', { name: /supprimer/i }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(name);
  await confirm.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page.getByRole('article').filter({ hasText: name })).toHaveCount(0);
});

test('un voyage inconnu affiche un message clair', async ({ page }) => {
  await page.goto('/trips/3f0fa7bf-e95b-4fee-ab08-b30a6385734f');
  await expect(page.getByText('Voyage introuvable')).toBeVisible();
});
