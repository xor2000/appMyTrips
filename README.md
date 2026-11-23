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

`apps/api/.dev.vars` (ignoré par git) définit `AUTH_SECRET` (signature des captchas) et
`ADMIN_EMAILS` (administrateurs, e-mails séparés par des virgules). En local, créer son compte sur
`/connexion` (onglet « Créer un compte ») avec un e-mail de `ADMIN_EMAILS` pour accéder à `/admin`.

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

Pour tester le hors ligne : `pnpm build`, lancer le Worker (`wrangler dev`), ouvrir un voyage puis
« Préparer hors ligne » (icône de nuage dans l'en-tête), et passer Chrome hors ligne (DevTools →
Network → Offline). Le service worker n'est jamais actif en `vite dev`. L'e2e `e2e/offline.spec.ts`
fait ce parcours avec `context.setOffline(true)`.

La découverte de lieux (bouton « Explorer » de la carte) interroge Overpass, puis Geoapify en
secours. Variables de `apps/api/.dev.vars` (toutes facultatives) :

- `OVERPASS_URLS` : instances Overpass séparées par des virgules (défaut : `overpass-api.de`, puis
  `overpass.private.coffee`) ;
- `GEOAPIFY_API_KEY` : clé Geoapify (gratuite, 3 000 crédits par jour). Sans elle, pas de secours
  quand Overpass est saturé.

Les trajets sont calculés par l'API :

- voiture, vélo, marche : OSRM, serveurs publics de FOSSGIS (https://routing.openstreetmap.de),
  sans clé (une requête par seconde au plus). En cas d'erreur, la durée est estimée ;
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
4. Déclarer le secret d'authentification (une longue valeur aléatoire, ex.
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`) et les
   administrateurs :

   ```bash
   pnpm --filter @mytrips/api exec wrangler secret put AUTH_SECRET
   pnpm --filter @mytrips/api exec wrangler secret put ADMIN_EMAILS
   ```

   `ADMIN_EMAILS` peut aussi aller dans les `vars` de `wrangler.jsonc` (il n'est pas secret, mais le
   dépôt est public).

5. Créer son compte sur `/connexion` avec un e-mail de `ADMIN_EMAILS`. Un compte créé avec l'e-mail
   d'un ancien utilisateur retrouve ses voyages et ses partages.

   Autres secrets :

   Facultatif mais recommandé : la clé Geoapify, secours de la découverte de lieux quand les
   instances publiques d'Overpass sont saturées (compte gratuit sur https://myprojects.geoapify.com) :

   ```bash
   pnpm --filter @mytrips/api exec wrangler secret put GEOAPIFY_API_KEY
   ```

   Pour Transitous (bus, train), le dépôt est public et `CONTACT_URL` (URL du dépôt) est défini
   dans les `vars` de `apps/api/wrangler.jsonc`.

Déploiement actuel : https://mytrips.dev-workshop-net.workers.dev.

Cloudflare Access n'est plus utilisé (bascule faite le 16/11/2026) : seule l'authentification de
l'application protège `/api`. Ne pas réactiver Access sur le Worker : il bloquerait les liens
d'invitation et de réinitialisation pour les personnes sans compte Cloudflare.

### Commandes de secours

Sans session (base distante ; `--local` pour la base locale) :

```bash
pnpm --filter @mytrips/api run reset-link moi@example.com
```

```bash
pnpm --filter @mytrips/api run unban-ip 203.0.113.7
```

`reset-link` affiche un lien de réinitialisation du mot de passe (24 h, usage unique) ; `unban-ip`
réactive une adresse bannie après 3 mots de passe faux (aussi possible depuis la page `/admin`).

## Licence

[MIT](LICENSE).
