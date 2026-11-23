import { expect, test } from '@playwright/test';

/** Style de carte minimal : les e2e ne dépendent pas des serveurs de tuiles. */
const EMPTY_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#dfe9e4' } }],
};

const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

test('fond de carte : liste qui s’ouvre en bas à droite, satellite chargé, retour au plan', async ({
  page,
  context,
}) => {
  await context.route('https://tiles.openfreemap.org/**', (route) =>
    route.request().url().includes('/styles/')
      ? route.fulfill({ json: EMPTY_STYLE })
      : route.abort(),
  );
  await context.route('https://*.tile.opentopomap.org/**', (route) => route.abort());
  let satelliteTiles = 0;
  await context.route('https://server.arcgisonline.com/**', (route) => {
    satelliteTiles += 1;
    return route.abort();
  });

  const name = uniqueName('Satellite');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau voyage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau voyage' });
  await dialog.getByLabel('Nom du voyage').fill(name);
  await dialog.getByLabel('Du', { exact: true }).fill('2026-07-10');
  await dialog.getByLabel('Au', { exact: true }).fill('2026-07-12');
  await dialog.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  // Comme la maquette de référence : un bouton « Fond de carte » en bas à droite de la carte,
  // qui ouvre la liste des fonds au-dessus de lui.
  const map = page.getByTestId('trip-map');
  const picker = map.getByRole('button', { name: 'Fond de carte' });
  await expect(picker).toBeVisible();
  await expect(map.getByRole('group', { name: 'Fond de carte' })).toHaveCount(0);
  const mapBox = await map.boundingBox();
  const pickerBox = await picker.boundingBox();
  expect(mapBox && pickerBox).toBeTruthy();
  expect(mapBox!.x + mapBox!.width - (pickerBox!.x + pickerBox!.width)).toBeLessThan(40);
  expect(pickerBox!.y).toBeGreaterThan(mapBox!.y + mapBox!.height / 2);

  const choose = async (label: string) => {
    await picker.click();
    const menu = page.getByRole('menu', { name: 'Choix du fond de carte' });
    await expect(menu).toBeVisible();
    // La liste s'ouvre au-dessus du bouton.
    expect(((await menu.boundingBox())?.y ?? 0) + 1).toBeLessThan(pickerBox!.y);
    await menu.getByRole('menuitemradio', { name: label }).click();
    await expect(menu).toHaveCount(0);
  };
  const checked = async () => {
    await picker.click();
    const name = await page
      .getByRole('menuitemradio', { checked: true })
      .textContent()
      .then((t) => t?.trim());
    await page.keyboard.press('Escape');
    return name;
  };

  expect(await checked()).toBe('Plan');
  expect(satelliteTiles).toBe(0);

  await choose('Satellite');
  expect(await checked()).toBe('Satellite');
  // Le style hybride a bien été appliqué : la carte demande les tuiles d'imagerie.
  await expect.poll(() => satelliteTiles).toBeGreaterThan(0);

  await choose('Plan');
  expect(await checked()).toBe('Plan');
});
