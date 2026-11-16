import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Compte principal des e2e, connecté par le projet « setup » (auth.setup.ts). */
export const DEV_EMAIL = 'dev@example.test';
/** Administrateur des e2e (ADMIN_EMAILS de wrangler dev, voir playwright.config.ts). */
export const ADMIN_EMAIL = 'admin@example.test';
export const PASSWORD = 'mot-de-passe-e2e';
/** Session enregistrée du compte principal. */
export const DEV_STATE = 'e2e/.auth/dev.json';

/**
 * Adresse IP fictive (plage de documentation IPv6), envoyée dans CF-Connecting-IP : en local,
 * wrangler dev la laisse passer. Chaque contexte a la sienne, pour que les limites et les
 * bannissements d'un test ne gênent pas les autres.
 */
export function freshIp(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16);
  return `2001:db8:${hex()}:${hex()}::${hex()}`;
}

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

/** Résout la question du captcha (« Combien font 7 + 5 ? »). */
export function solve(question: string): string {
  const [a, b] = (question.match(/\d+/g) ?? []).map(Number);
  return String((a ?? 0) + (b ?? 0));
}

/** Nouveau contexte de navigateur sans session, avec sa propre adresse IP. */
export async function anonymousContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { 'cf-connecting-ip': freshIp() },
  });
}

/** Inscription par la page de connexion (question de calcul résolue). */
export async function signupViaUi(page: Page, email: string, password = PASSWORD) {
  if (!page.url().includes('/connexion')) await page.goto('/connexion');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  const question = page.getByText(/^Combien font \d+ \+ \d+ \?$/);
  await expect(question).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password);
  await page
    .getByLabel('Réponse', { exact: true })
    .fill(solve((await question.textContent()) ?? ''));
  await page.getByRole('button', { name: 'Créer le compte' }).click();
}

export async function loginViaUi(page: Page, email: string, password = PASSWORD) {
  if (!page.url().includes('/connexion')) await page.goto('/connexion');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Nouvel utilisateur inscrit, dans son propre contexte. */
export async function newUser(browser: Browser, label: string) {
  const context = await anonymousContext(browser);
  const page = await context.newPage();
  const email = uniqueEmail(label);
  await signupViaUi(page, email);
  await expect(page.getByTestId('user-email')).toHaveText(email);
  return { context, page, email };
}
