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

Créer ou mettre à jour la base D1 locale (à refaire après chaque nouvelle migration) :

```bash
pnpm --filter @mytrips/api db:migrate:local
```

## Développement

```bash
pnpm dev
```

- Front : http://localhost:5173 (Vite). Les appels `/api` sont relayés vers le Worker local.
- API : http://localhost:8787 (`wrangler dev`).

La recherche de lieux utilise Photon (`https://photon.komoot.io`) via l'API ; la variable `PHOTON_URL`
de `apps/api/.dev.vars` permet d'en changer.

La découverte de lieux (bouton « Explorer » de la carte) interroge Overpass, puis Geoapify en
secours. Variables de `apps/api/.dev.vars` (toutes facultatives) :

- `OVERPASS_URLS` : instances Overpass séparées par des virgules (défaut : `overpass-api.de`, puis
  `overpass.private.coffee`) ;
- `GEOAPIFY_API_KEY` : clé Geoapify (gratuite, 3 000 crédits par jour). Sans elle, pas de secours
  quand Overpass est saturé.

Les trajets sont calculés par l'API :

- voiture, vélo, marche : OpenRouteService, avec `ORS_API_KEY` (clé gratuite sur
  https://openrouteservice.org, utilisée sur `api.heigit.org`). Sans clé, la durée est estimée ;
- bus, train : Transitous, sans clé. Sa politique d'usage impose un projet open source publié,
  un usage non commercial et un contact dans le User-Agent : `CONTACT_URL` (URL du projet) ;
- avion, ferry : calcul local.

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

| Commande          | Rôle                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`        | Front Vite + Worker local                                                      |
| `pnpm build`      | Build de production du front (`apps/web/build`, servi par le Worker)           |
| `pnpm test`       | Tests unitaires (Vitest) de `packages/core`, `apps/api` et `apps/web`          |
| `pnpm test:e2e`   | Tests end-to-end (Playwright) sur le build servi par `wrangler dev`            |
| `pnpm lint`       | ESLint + vérification Prettier                                                 |
| `pnpm format`     | Formatage Prettier                                                             |
| `pnpm typecheck`  | TypeScript (tsc, svelte-check) sur tout le monorepo                            |
| `pnpm run deploy` | Build puis déploiement du Worker (`pnpm deploy` seul est une commande de pnpm) |

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

1. Base D1 : déjà créée (`mytrips`, son `database_id` est dans `apps/api/wrangler.jsonc`). Sur un autre
   compte : `pnpm --filter @mytrips/api exec wrangler d1 create mytrips`, puis reporter l'identifiant.
   R2 (bucket `mytrips-files`) sera ajouté au lot 6.

2. Appliquer les migrations : `pnpm --filter @mytrips/api db:migrate:remote`. À faire **avant** chaque
   déploiement qui ajoute une migration.
3. Déployer : `pnpm run deploy` (et non `pnpm deploy`, commande intégrée de pnpm).
4. Protéger le Worker avec **Cloudflare Access** : Workers & Pages → mytrips → **Domains** → ligne
   **Production** (workers.dev) → **Enable Access** :
   - **Scope** : « All traffic » ;
   - **Authentication policy** : « Cloudflare account » (membres du compte), ou une liste d'e-mails
     dans Zero Trust → Access → Applications ;
   - désactiver les URL **Preview** (elles exposeraient d'autres versions sans cette protection) ;
   - noter l'**AUD** affiché. Le **domaine d'équipe** est l'hôte vers lequel l'URL du Worker redirige
     (`curl -I https://mytrips.<sous-domaine>.workers.dev` → `https://<équipe>.cloudflareaccess.com/…`).
5. Déclarer les secrets du Worker :

   ```bash
   pnpm --filter @mytrips/api exec wrangler secret put ACCESS_TEAM_DOMAIN
   pnpm --filter @mytrips/api exec wrangler secret put ACCESS_AUD
   ```

   Facultatif mais recommandé : la clé Geoapify, secours de la découverte de lieux quand les
   instances publiques d'Overpass sont saturées (compte gratuit sur https://myprojects.geoapify.com) :

   ```bash
   pnpm --filter @mytrips/api exec wrangler secret put GEOAPIFY_API_KEY
   ```

   Recommandé aussi : la clé OpenRouteService (sinon voiture, vélo et marche sont estimés) :

   ```bash
   pnpm --filter @mytrips/api exec wrangler secret put ORS_API_KEY
   ```

   Pour Transitous (bus, train), le dépôt doit être public et `CONTACT_URL` défini (variable
   `vars` de `apps/api/wrangler.jsonc`, ex. l'URL du dépôt).

Déploiement actuel : https://mytrips.dev-workshop-net.workers.dev (équipe Access
`mytraces-pages.cloudflareaccess.com`).

`DEV_USER_EMAIL` ne doit jamais être défini en production. Il est de toute façon ignoré dès que
`ACCESS_AUD` est défini.
