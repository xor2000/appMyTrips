import { expect, test } from '@playwright/test';
import { DEV_EMAIL, accountButton } from './auth-helpers';

test('la page d’accueil affiche MyTrips', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MyTrips/);
  await expect(page.getByRole('link', { name: /mytrips/i })).toBeVisible();
});

test('l’e-mail de l’utilisateur connecté est affiché via /api/me', async ({ page }) => {
  await page.goto('/');
  await accountButton(page, DEV_EMAIL).click();
  await expect(page.getByRole('menu')).toContainText(DEV_EMAIL);
});

test('une route inconnue du front renvoie la SPA (fallback)', async ({ page }) => {
  await page.goto('/trips/inexistant');
  await expect(page.getByRole('link', { name: /mytrips/i })).toBeVisible();
});

test('le manifeste PWA est servi', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toBe('MyTrips');
  expect(manifest.display).toBe('standalone');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
});

test('le service worker est enregistré et actif', async ({ page }) => {
  await page.goto('/');
  // `ready` se résout dès que le SW est « activating » : attendre l'état final. Le précache
  // (~1,6 Mo avec MapLibre) peut prendre plus de 5 s quand les tests tournent en parallèle.
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state), {
      timeout: 20_000,
    })
    .toBe('activated');
});

test('/api/health répond sur la même origine', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
