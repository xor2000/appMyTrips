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
const ideas = (page: Page) => page.getByRole('region', { name: 'Idées' });

/** Voyage de deux jours, le Louvre rangé dans les idées. */
async function tripWithIdea(page: Page) {
  const name = uniqueName('Dossiers');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-11');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('tab', { name: /J1/ }).click();
  await page.getByRole('button', { name: 'Ajouter un lieu' }).click();
  const add = page.getByRole('dialog', { name: 'Ajouter un lieu' });
  await add.getByRole('searchbox', { name: 'Rechercher un lieu' }).fill('Louvre');
  await add.getByRole('button', { name: /Musée du Louvre/ }).click();
  await expect(add).toHaveCount(0);
  await page
    .getByTestId('day-timeline')
    .getByTestId('step-card')
    .filter({ hasText: 'Musée du Louvre' })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Déplacer vers' }).click();
  await page
    .getByRole('menu', { name: 'Déplacer vers' })
    .getByRole('menuitem', { name: /^Idées/ })
    .click();
  await expect(ideas(page).getByTestId('step-card')).toContainText(['Musée du Louvre']);
}

/** Clic droit sur l'en-tête d'un dossier. */
async function folderMenu(page: Page, name: string) {
  await page
    .getByTestId('group-card')
    .filter({ hasText: name })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click({ button: 'right' });
  return page.getByRole('menu', { name, exact: true });
}

test('dossier d’idées : création avec icône et couleur, dépôt, modification, déplacement, suppression', async ({
  page,
}) => {
  await tripWithIdea(page);
  // Plus de bouton « Ajouter une idée » : un bouton icône « Nouveau dossier d'idées ».
  await expect(ideas(page).getByRole('button', { name: 'Ajouter une idée' })).toHaveCount(0);
  await ideas(page).getByRole('button', { name: 'Nouveau dossier d’idées' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau dossier' });
  await dialog.getByLabel('Nom du dossier').fill('À voir');
  await dialog.getByText('Musée', { exact: true }).click();
  await dialog.getByTitle('Rose').click();
  await dialog.getByRole('button', { name: 'Créer le dossier' }).click();
  const folder = ideas(page).getByTestId('group-card').filter({ hasText: 'À voir' });
  await expect(folder).toHaveAttribute('data-icon', 'museum');
  await expect(folder).toHaveAttribute('style', /--gc: var\(--leg-4\)/);

  // Glisser l'idée dans le dossier.
  await ideas(page)
    .getByTestId('step-card')
    .filter({ hasText: 'Musée du Louvre' })
    .dragTo(ideas(page).getByLabel('Déposer à la fin de À voir'));
  await expect(folder.getByTestId('step-card')).toContainText(['Musée du Louvre']);

  // Modifier : couleur Vert.
  await (await folderMenu(page, 'À voir')).getByRole('menuitem', { name: 'Modifier' }).click();
  const edit = page.getByRole('dialog', { name: 'Modifier le dossier' });
  await edit.getByTitle('Vert').click();
  await edit.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(folder).toHaveAttribute('style', /--gc: var\(--leg-6\)/);
  // Ctrl+Z : retour au rose ; Ctrl+Y : de nouveau vert.
  await page.locator('body').press('Control+z');
  await expect(folder).toHaveAttribute('style', /--gc: var\(--leg-4\)/);
  await page.locator('body').press('Control+y');
  await expect(folder).toHaveAttribute('style', /--gc: var\(--leg-6\)/);

  // Déplacer vers J1 : le dossier part avec son idée.
  await (await folderMenu(page, 'À voir')).getByRole('menuitem', { name: 'Déplacer vers' }).click();
  await page
    .getByRole('menu', { name: 'Déplacer vers' })
    .getByRole('menuitem', { name: /^J1/ })
    .click();
  const dayFolder = page.getByTestId('day-timeline').getByTestId('group-card');
  await expect(dayFolder).toContainText('À voir');
  await expect(dayFolder.getByTestId('step-card')).toContainText(['Musée du Louvre']);
  await expect(ideas(page).getByTestId('group-card')).toHaveCount(0);

  // Supprimer en gardant ses étapes.
  await (await folderMenu(page, 'À voir')).getByRole('menuitem', { name: 'Supprimer' }).click();
  await page
    .getByRole('alertdialog', { name: 'Supprimer le dossier ?' })
    .getByRole('button', { name: 'Garder les étapes' })
    .click();
  await expect(page.getByTestId('group-card')).toHaveCount(0);
  await expect(page.getByTestId('day-timeline').getByTestId('step-card')).toContainText([
    'Musée du Louvre',
  ]);
});

test('bouton dossier de l’en-tête du jour ; plus de « Nouveau dossier » sous les lieux', async ({
  page,
}) => {
  await tripWithIdea(page);
  // Le bouton de l'en-tête du jour, près de la barre du temps, est une icône.
  const add = page.getByRole('button', { name: 'Nouveau dossier', exact: true });
  await expect(add).toHaveCount(1);
  await expect(add).toHaveText('');
  await add.click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau dossier' });
  await dialog.getByLabel('Nom du dossier').fill('Matinée');
  await dialog.getByRole('button', { name: 'Créer le dossier' }).click();
  const folder = page.getByTestId('day-timeline').getByTestId('group-card');
  await expect(folder).toContainText('Matinée');
  await expect(folder).toHaveAttribute('data-icon', 'folder');
});
