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

/** Crée un voyage de 3 jours (10 au 12 juillet 2026) et ouvre J1. */
async function createTripAndOpenDay1(page: Page) {
  const name = uniqueName('Étapes');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
}

/** Ajoute un lieu au jour affiché, via la recherche. */
async function addPlace(page: Page, query: string, resultName: string) {
  await page.getByRole('button', { name: 'Ajouter un lieu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill(query);
  await dialog.getByRole('button', { name: new RegExp(resultName) }).click();
  await expect(dialog).toHaveCount(0);
}

/** Noms des étapes de la timeline du jour, dans l'ordre affiché. */
async function timelineNames(page: Page) {
  return page
    .getByTestId('day-timeline')
    .getByTestId('step-card')
    .locator('.name')
    .allTextContents();
}

test('ajouter un lieu trouvé par la recherche : carte d’étape et marqueur numéroté', async ({
  page,
}) => {
  await createTripAndOpenDay1(page);
  await addPlace(page, 'Louvre', 'Musée du Louvre');
  const card = page.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' });
  await expect(card).toContainText('Musée · 2 h sur place');
  await expect(page.locator('.map-marker', { hasText: '1' })).toBeVisible();
});

test('réordonner les étapes : boutons et glisser-déposer, la numérotation suit', async ({
  page,
}) => {
  await createTripAndOpenDay1(page);
  await addPlace(page, 'Louvre', 'Musée du Louvre');
  await addPlace(page, 'Orsay', 'Musée d’Orsay');
  await addPlace(page, 'Eiffel', 'Tour Eiffel');
  expect(await timelineNames(page)).toEqual(['Musée du Louvre', 'Musée d’Orsay', 'Tour Eiffel']);

  // Au clavier / bouton : monter la Tour Eiffel d'un cran.
  await page.getByTestId('step-card').filter({ hasText: 'Tour Eiffel' }).hover();
  await page.getByRole('button', { name: 'Monter Tour Eiffel' }).click();
  await expect
    .poll(() => timelineNames(page))
    .toEqual(['Musée du Louvre', 'Tour Eiffel', 'Musée d’Orsay']);

  // Glisser-déposer : Orsay en tête.
  await page
    .getByTestId('step-card')
    .filter({ hasText: 'Musée d’Orsay' })
    .dragTo(page.getByTestId('day-timeline').getByTestId('drop-zone').first());
  await expect
    .poll(() => timelineNames(page))
    .toEqual(['Musée d’Orsay', 'Musée du Louvre', 'Tour Eiffel']);
  await expect(page.getByTestId('step-card').first().locator('.label')).toHaveText('1');
});

test('regrouper des étapes dans un dossier repliable', async ({ page }) => {
  await createTripAndOpenDay1(page);
  await addPlace(page, 'Notre-Dame', 'Notre-Dame de Paris');
  await addPlace(page, 'Comptoir', 'Le Comptoir');
  await page.getByRole('button', { name: 'Nouveau dossier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau dossier' });
  await dialog.getByLabel('Nom du dossier').fill('Île de la Cité');
  await dialog.getByRole('button', { name: 'Créer le dossier' }).click();

  const group = page.getByTestId('group-card').filter({ hasText: 'Île de la Cité' });
  await expect(group).toContainText('0 étape');
  const names = ['Notre-Dame de Paris', 'Le Comptoir'];
  for (const [i, name] of names.entries()) {
    await page
      .getByTestId('day-timeline')
      .getByTestId('step-card')
      .filter({ hasText: name })
      .dragTo(group.getByTestId('drop-zone').last());
    // Attendre l'affichage du dépôt : la liste change de forme, la cible suivante aussi.
    await expect(group.getByTestId('step-card')).toHaveCount(i + 1);
  }
  await expect(group).toContainText('2 étapes');
  await expect(group.getByTestId('step-card')).toHaveCount(2);
  await group.getByRole('button', { name: 'Replier Île de la Cité' }).click();
  await expect(group.getByTestId('step-card')).toHaveCount(0);
});

test('une idée se place dans un jour (onglet), et une étape retourne aux idées', async ({
  page,
}) => {
  await createTripAndOpenDay1(page);
  await page.getByRole('button', { name: 'Ajouter une idée' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une idée' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Orsay');
  await dialog.getByRole('button', { name: /Musée d’Orsay/ }).click();

  const ideas = page.getByRole('region', { name: 'Idées' });
  await expect(ideas.getByTestId('step-card')).toHaveCount(1);
  // Glisser l'idée sur l'onglet J2.
  await ideas.getByTestId('step-card').dragTo(page.getByRole('tab', { name: /J2/ }));
  await expect(ideas.getByTestId('step-card')).toHaveCount(0);
  await page.getByRole('tab', { name: /J2/ }).click();
  await expect(page.getByTestId('day-timeline')).toContainText('Musée d’Orsay');

  // Retour aux idées par l'éditeur.
  await page
    .getByTestId('day-timeline')
    .getByRole('button', { name: /Musée d’Orsay Musée/ })
    .click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await editor.getByLabel('Jour').selectOption({ label: 'Idées (pas encore placé)' });
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ideas.getByTestId('step-card')).toHaveCount(1);
});

test('une idée apparaît sur la carte, sans numéro ni trajet', async ({ page }) => {
  await createTripAndOpenDay1(page);
  await addPlace(page, 'Louvre', 'Musée du Louvre');
  await page.getByRole('button', { name: 'Ajouter une idée' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une idée' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Orsay');
  await dialog.getByRole('button', { name: /Musée d’Orsay/ }).click();
  await expect(dialog).toHaveCount(0);

  // Marqueur « Idée » distinct ; l'étape du jour garde le numéro 1 ; aucun tracé de trajet.
  await expect(page.getByRole('button', { name: 'Idée · Musée d’Orsay' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 · Musée du Louvre' })).toBeVisible();
  await expect(page.getByTestId('trip-map')).toHaveAttribute('data-leg-lines', '0');
  await expect(page.getByTestId('day-timeline').getByTestId('leg-tile')).toHaveCount(0);

  // Aussi sur la carte de tout le voyage.
  await page.getByRole('tab', { name: 'Tout le voyage' }).click();
  await expect(page.getByRole('button', { name: 'Idée · Musée d’Orsay' })).toBeVisible();
});

test('type « Parking » : choisi dans l’éditeur, avec son libellé', async ({ page }) => {
  await createTripAndOpenDay1(page);
  await addPlace(page, 'Louvre', 'Musée du Louvre');
  await page.getByRole('button', { name: /Musée du Louvre Musée/ }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await editor.getByLabel('Type').selectOption({ label: 'Parking' });
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  const card = page.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' });
  await expect(card).toContainText('Parking ·');
});

test('supprimer une étape demande confirmation', async ({ page }) => {
  await createTripAndOpenDay1(page);
  await addPlace(page, 'Louvre', 'Musée du Louvre');
  const card = page.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' });
  await card.hover();
  await page.getByRole('button', { name: 'Supprimer Musée du Louvre' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Supprimer l’étape ?' });
  await confirm.getByRole('button', { name: 'Annuler' }).click();
  await expect(card).toHaveCount(1);

  await card.hover();
  await page.getByRole('button', { name: 'Supprimer Musée du Louvre' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(card).toHaveCount(0);
});

test('modifier la durée et fixer une heure', async ({ page }) => {
  await createTripAndOpenDay1(page);
  await addPlace(page, 'Louvre', 'Musée du Louvre');
  await page.getByRole('button', { name: /Musée du Louvre Musée/ }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await editor.getByLabel('Durée sur place (min)').fill('150');
  await editor.getByLabel('Heure fixe').check();
  await editor.getByLabel('Heure', { exact: true }).fill('10:30');
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  const card = page.getByTestId('step-card').filter({ hasText: 'Musée du Louvre' });
  await expect(card).toContainText('2 h 30 sur place');
  await expect(card).toContainText('10:30');
});

test('un séjour de 2 nuits apparaît en fin de J1, au début et à la fin de J2, au début de J3', async ({
  page,
}) => {
  await createTripAndOpenDay1(page);
  await page.getByRole('button', { name: 'Ajouter un séjour' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau séjour' });
  await dialog.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Hôtel des Arts');
  await dialog.getByRole('button', { name: /Hôtel des Arts/ }).click();
  await expect(dialog.getByLabel('Arrivée le')).toHaveValue('2026-07-10');
  await dialog.getByLabel('Départ le').fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Ajouter le séjour' }).click();

  const stays = page.getByTestId('day-timeline').getByTestId('stay-card');
  await expect(stays).toHaveText([/Hôtel des Arts.*Check-in · 17:00/]);
  await page.getByRole('tab', { name: /J2/ }).click();
  await expect(stays).toHaveText([/Départ · 10:00/, /Retour · 17:00/]);
  await page.getByRole('tab', { name: /J3/ }).click();
  await expect(stays).toHaveText([/Check-out · 10:00/]);
});
