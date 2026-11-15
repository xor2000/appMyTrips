# MyTrips

Application web progressive (PWA) **desktop** pour organiser un voyage : liste des voyages, timeline des
étapes par jour, trajets entre étapes et carte. Front SvelteKit, API sur un Worker Cloudflare.

Feuille de route : épique [#1](https://github.com/xor2000/appMyTrips/issues/1) (lots 0 à 7).
Spécification : [docs/specification.md](docs/specification.md).

## Prérequis

- Node.js 22 ou plus (24 recommandé, voir `.nvmrc`)
- pnpm (version fixée par `packageManager` dans `package.json`, activée par Corepack)

## Installation

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

`apps/api/.dev.vars` (ignoré par git) définit `DEV_USER_EMAIL`, l'identité utilisée en local à la place
de Cloudflare Access.

## Développement

```bash
pnpm dev
```

- Front : http://localhost:5173 (Vite). Les appels `/api` sont relayés vers le Worker local.
- API : http://localhost:8787 (`wrangler dev`).

Si le port 8787 est déjà pris, lancer l'API sur un autre port et indiquer son URL au front :

```bash
pnpm --filter @mytrips/api exec wrangler dev --port 8797
MYTRIPS_API_URL=http://localhost:8797 pnpm --filter @mytrips/web dev
```

Le service worker n'est **pas** actif en `dev`. Pour tester la PWA telle qu'en production, servir le build
par le Worker :

```bash
pnpm build
pnpm --filter @mytrips/api exec wrangler dev
```

## Scripts

| Commande         | Rôle                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm dev`       | Front Vite + Worker local                                             |
| `pnpm build`     | Build de production du front (`apps/web/build`, servi par le Worker)  |
| `pnpm test`      | Tests unitaires (Vitest) de `packages/core`, `apps/api` et `apps/web` |
| `pnpm test:e2e`  | Tests end-to-end (Playwright) sur le build servi par `wrangler dev`   |
| `pnpm lint`      | ESLint + vérification Prettier                                        |
| `pnpm format`    | Formatage Prettier                                                    |
| `pnpm typecheck` | TypeScript (tsc, svelte-check) sur tout le monorepo                   |
| `pnpm deploy`    | Build puis déploiement du Worker                                      |

Avant le premier `pnpm test:e2e` : `pnpm exec playwright install chromium`.

Les icônes PWA de `apps/web/static/` sont générées depuis `apps/web/static/favicon.svg` :
`pnpm --filter @mytrips/web icons`.

## Structure

```
apps/web       SvelteKit 3 (SPA, adapter-static) + PWA Workbox
apps/api       Worker Cloudflare (Hono) : API /api/*, sert aussi le build du front
packages/core  Logique métier partagée (schémas Zod, plus tard horaires, GPX…)
e2e            Tests Playwright
docs           Spécification et journal des tâches (docs/tasks)
```

## Déploiement sur Cloudflare

Un seul Worker (`mytrips`) sert le front et l'API sur la même origine.

1. Créer les ressources :

   ```bash
   pnpm --filter @mytrips/api exec wrangler d1 create mytrips
   pnpm --filter @mytrips/api exec wrangler r2 bucket create mytrips-files
   ```

   Reporter l'identifiant de la base dans `apps/api/wrangler.jsonc` (`database_id`).

2. Appliquer les migrations : `pnpm --filter @mytrips/api db:migrate:remote`.
3. Déployer : `pnpm deploy`.
4. Protéger le Worker avec **Cloudflare Access** (Zero Trust → Access → Applications) :
   - application de type « Self-hosted » sur le domaine du Worker ;
   - politique « Allow » avec la **liste blanche** des e-mails autorisés ;
   - noter le **domaine d'équipe** (ex. `mytrips.cloudflareaccess.com`) et l'**Application Audience (AUD)**.
5. Déclarer les secrets du Worker :

   ```bash
   pnpm --filter @mytrips/api exec wrangler secret put ACCESS_TEAM_DOMAIN
   pnpm --filter @mytrips/api exec wrangler secret put ACCESS_AUD
   ```

`DEV_USER_EMAIL` ne doit jamais être défini en production. Il est de toute façon ignoré dès que
`ACCESS_AUD` est défini.
