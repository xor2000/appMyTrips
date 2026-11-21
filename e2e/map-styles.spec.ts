import { expect, test } from '@playwright/test';

/** Style de carte minimal : les e2e ne dépendent pas des serveurs de tuiles. */
const EMPTY_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#dfe9e4' } }],
};

const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

test('fond satellite : imagerie Esri chargée, retour au plan', async ({ page, context }) => {
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

  const styles = page.getByRole('group', { name: 'Fond de carte' });
  const plan = styles.getByRole('button', { name: 'Plan' });
  const satellite = styles.getByRole('button', { name: 'Satellite' });
  await expect(plan).toHaveAttribute('aria-pressed', 'true');
  expect(satelliteTiles).toBe(0);

  await satellite.click();
  await expect(satellite).toHaveAttribute('aria-pressed', 'true');
  await expect(plan).toHaveAttribute('aria-pressed', 'false');
  // Le style hybride a bien été appliqué : la carte demande les tuiles d'imagerie.
  await expect.poll(() => satelliteTiles).toBeGreaterThan(0);

  await plan.click();
  await expect(plan).toHaveAttribute('aria-pressed', 'true');
  await expect(satellite).toHaveAttribute('aria-pressed', 'false');
});
