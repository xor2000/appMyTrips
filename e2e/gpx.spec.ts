import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

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

/** GPX d'exemple de core (packages/core/test/fixtures/generate-gpx.mjs). */
const fixture = (name: string) =>
  readFileSync(new URL(`../packages/core/test/fixtures/${name}`, import.meta.url), 'utf8');

const uniqueName = (label: string) => `${label} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function tripOnDay1(page: Page) {
  const name = uniqueName('Randos');
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

/** Glisse un fichier GPX depuis « l'ordinateur » sur la timeline du jour. */
async function dropGpx(target: Locator, fileName: string, xml: string) {
  await target.evaluate(
    (el, { fileName, xml }) => {
      const data = new DataTransfer();
      data.items.add(new File([xml], fileName, { type: 'application/gpx+xml' }));
      for (const type of ['dragover', 'drop']) {
        el.dispatchEvent(
          new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
        );
      }
    },
    { fileName, xml },
  );
}

test('glisser un GPX sur J1 : randonnée créée, distance, D+, durée et tracé', async ({ page }) => {
  await tripOnDay1(page);
  await dropGpx(page.getByTestId('day-timeline'), 'tournette.gpx', fixture('loop.gpx'));

  const card = page.getByTestId('step-card').filter({ hasText: 'Tournette (test)' });
  await expect(card).toContainText('GPX 12,4 km');
  await expect(card).toContainText(/D\+ 6\d\d m/);
  // 12,37 km (boucle d'exemple non refermée) à 3,5 km/h : 212 min, arrondies à 3 h 30.
  await expect(card).toContainText('Randonnée · 3 h 30 sur place');
  await expect(card).toContainText('08:00 → 11:30');
  await expect(page.getByTestId('trip-map')).toHaveAttribute('data-leg-lines', '1');
});

test('cocher le dénivelé : la durée et les horaires du jour se mettent à jour', async ({
  page,
}) => {
  await tripOnDay1(page);
  await dropGpx(page.getByTestId('day-timeline'), 'tournette.gpx', fixture('loop.gpx'));
  const card = page.getByTestId('step-card').filter({ hasText: 'Tournette (test)' });
  await expect(card).toContainText('3 h 30');

  await card.getByRole('button', { name: /Tournette \(test\) Randonnée/ }).click();
  await page.getByTestId('step-popup').getByRole('button', { name: 'Modifier' }).click();
  const editor = page.getByRole('dialog', { name: 'Modifier l’étape' });
  await expect(editor.getByRole('img', { name: /Profil altimétrique/ })).toBeVisible();
  await editor.getByLabel('Inclure le dénivelé (+1 h / 600 m)').check();
  await editor.getByRole('button', { name: 'Enregistrer' }).click();
  // + 1 h 02 pour 619 m de D+ : 274 min, arrondies à 4 h 35.
  await expect(card).toContainText('Randonnée · 4 h 35 sur place');
  await expect(card).toContainText('08:00 → 12:35');
});

test('randonnée linéaire importée par le bouton : marqueur d’arrivée distinct sur la carte', async ({
  page,
}) => {
  await tripOnDay1(page);
  await page.getByLabel('Importer une randonnée (GPX)').setInputFiles({
    name: 'crete.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(fixture('linear.gpx')),
  });
  await expect(page.getByTestId('step-card').filter({ hasText: 'Tour test' })).toContainText('GPX');
  await expect(page.locator('.map-marker', { hasText: '⚑' })).toHaveCount(1);
});
