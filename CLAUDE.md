# MyTrips — consignes pour Claude

Lire aussi : [docs/specification.md](docs/specification.md) (architecture, décisions, limites) et les
entrées récentes de [docs/tasks/](docs/tasks/). Feuille de route : épique #1 et ses sous-issues (lots).

## Commandes

```bash
pnpm install
pnpm dev            # front Vite (5173) + Worker local (8787)
pnpm test           # Vitest : core, api (runtime Workers), web (jsdom)
pnpm test:e2e       # Playwright sur le build servi par wrangler dev (port 8788)
pnpm lint           # ESLint + Prettier --check
pnpm typecheck      # tsc + svelte-check
pnpm build          # build de production du front
```

Vérifications attendues avant de rendre un travail : `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`, `pnpm test:e2e`.

## Structure et responsabilités

- `packages/core` : **toute la logique métier pure** (schémas Zod, calculs d'horaires, GPX, catégories…),
  sans dépendance au DOM ni à Cloudflare. Partagée par le front, l'API et la future appli mobile.
  Exportée en source TypeScript (`exports: ./src/index.ts`), sans étape de build.
- `apps/api` : Worker Hono. `src/app.ts` (`createApp({ auth })`) monte les routes sous `/api` ;
  `src/index.ts` exporte `createApp()` avec Access. Routes métier dans `src/routes/`, requêtes D1
  dans `src/db/`. Droits par voyage : middleware `access('read' | 'write' | 'owner')`. Bindings dans
  `src/env.ts`. Migrations D1 dans `migrations/`.
- `apps/web` : SvelteKit 3 en SPA (`ssr = false`, `adapter-static` avec `fallback: 'index.html'`).
  Configuration SvelteKit **dans `vite.config.ts`** (via `withPwa`), il n'y a pas de `svelte.config.js`.
- `e2e` : parcours Playwright.

## Conventions

- Interface, messages et commentaires en **français** ; identifiants de code en anglais.
- TypeScript strict (`noUncheckedIndexedAccess`). Svelte 5 avec runes (`$props`, `$state`, `$derived`).
- Tests : `*.test.ts` à côté du code (core, web) ou dans `apps/api/test/`. Noms de tests en français.
  TDD : écrire les tests d'abord et les voir échouer.
- Styles : uniquement via les variables de `apps/web/src/lib/styles/tokens.css` (design « Pastel
  ludique », thèmes clair et sombre). Pas de couleur en dur dans les composants.
- Dépendances en version exacte (`.npmrc` : `save-exact=true`).
- Pas de secret dans le dépôt : `wrangler secret put` en production, `apps/api/.dev.vars` en local.

## Pièges connus

- **Service worker uniquement en build** : jamais actif en `vite dev`. Tester la PWA avec
  `pnpm build` puis `wrangler dev` (c'est ce que font les e2e).
- **SvelteKit 3** : l'alias `$lib` n'existe plus. Utiliser `#lib/...` (champ `imports` de
  `apps/web/package.json`) **avec l'extension** pour les modules TS : `import { x } from '#lib/api.ts'`.
- **`@vite-pwa/sveltekit` 2** : API `withPwa(configKit, optionsPwa)`. Options Workbox sous `generateSW`
  (l'ancienne clé `workbox` est dépréciée). Le plugin ajoute toujours le motif `prerendered/**`, d'où
  `globStrict: false`. Le manifeste est lié en dur dans `src/app.html`.
- **Tests du Worker** : `@cloudflare/vitest-plugin` (l'ancien `@cloudflare/vitest-pool-workers` est
  déprécié). Appeler le Worker avec `exports.default.fetch()` de `cloudflare:workers` (`SELF` est
  déprécié). Le typage passe par `Cloudflare.GlobalProps.mainModule` dans `apps/api/test/env.d.ts`.
  Premier appel lent (démarrage de workerd) : `testTimeout` de 20 s, paquets testés un par un.
- **`DEV_USER_EMAIL`** : contourne Access en local seulement, et seulement si `ACCESS_AUD` est absent.
  Ne jamais le définir en production.
- **Tests d'API** : utiliser `call(user, method, path, body?, headers?)` de `apps/api/test/helpers.ts`
  (identité par en-tête `x-test-user`, vraie D1, migrations appliquées par `test/apply-migrations.ts`).
  L'isolation du stockage entre tests n'est pas garantie : ne jamais supposer une base vide (filtrer
  sur ses propres données).
- **Paramètres de chemin Hono** : `c.req.param()` renvoie la valeur **déjà décodée**. Ne pas rappeler
  `decodeURIComponent` (un `%` ferait planter la route).
- **Verrou optimiste** : toute écriture sur un voyage ou ses objets passe par `writeWithVersion`
  (`apps/api/src/routes/trips.ts`) : version incrémentée et requêtes conditionnées dans un seul
  `db.batch`.
- **MapLibre 6** : son worker doit être déclaré explicitement
  (`import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')` puis `setWorkerUrl`), sinon il est
  cherché à côté du chunk et le Worker Cloudflare renvoie le fallback HTML. L'e2e « la carte charge
  son web worker sans erreur » le vérifie.
- **E2E** :
  - base D1 locale dédiée (`apps/api/.wrangler/e2e`), migrée au démarrage et conservée entre les
    exécutions : noms de voyages uniques (`uniqueName`) ;
  - tuiles de carte interceptées (style vide) ;
  - autre utilisateur via `browser.newContext({ extraHTTPHeaders: { 'x-dev-user-email': … } })` ;
  - `getByLabel` fait une recherche partielle insensible à la casse : utiliser `{ exact: true }`
    pour des libellés courts (« Du » correspond aussi à « Nom du voyage »).
- **Écritures sur un voyage (front)** : toujours passer par `apply()` de la page voyage (file
  `createSerialQueue`) et lire la version au moment de l'exécution (`() => updateStep(id, …, version(), …)`).
  Deux écritures rapprochées avec la même version donnent un faux conflit.
- **Zones de dépôt** (`DropZone.svelte`) : hauteur fixe. Une zone qui grandit pendant un glisser décale
  la liste sous le curseur et le dépôt tombe ailleurs (constaté en e2e).
- **E2E et services externes** : Photon et Overpass sont appelés par le Worker, pas par le
  navigateur (une interception Playwright ne les voit pas). Playwright lance des services factices
  (`e2e/mock-services.mjs`, port 8798) et passe `PHOTON_URL` et `OVERPASS_URLS` à `wrangler dev`.
  Après un glisser-déposer, attendre que le résultat soit affiché avant l'action suivante.
- **Découverte de lieux** (`apps/api/src/routes/poi.ts`) : jamais de requête automatique au
  déplacement de la carte (politique d'usage d'Overpass) ; le cache `poi_cache` (case de zoom 13 ×
  catégorie, 7 jours) ne doit recevoir que des réponses complètes. Les tests d'API fixent
  `OVERPASS_URLS` et `GEOAPIFY_API_KEY` (`poiCaller`) et explorent chacun leur propre zone.
- **Routes d'étapes** (`apps/api/src/routes/steps.ts`) : utilitaires communs (`access`, `parseBody`,
  `requireVersion`, `writeWithVersion`) dans `routes/shared.ts`.
- **Ordre des routes Hono** : une route déclarée avant `app.use('*', accessAuth())` reste publique
  (c'est voulu pour `/api/health`). Toute nouvelle route doit être déclarée **après** le middleware.
- **Déploiement** : `pnpm run deploy` (build + `wrangler deploy`). `pnpm deploy` sans `run` est une
  commande intégrée de pnpm ; dans les scripts, toujours écrire `pnpm --filter <paquet> run deploy`.
  Worker déployé : https://mytrips.dev-workshop-net.workers.dev (base D1 `mytrips`, région WEUR).
- **URL Preview** : `"preview_urls": false` dans `wrangler.jsonc` est indispensable. Sans lui,
  chaque `wrangler deploy` réactive les URL Preview, que Cloudflare Access ne protège pas.
- **`.dev.vars` et tests** : `@cloudflare/vitest-plugin` charge `apps/api/.dev.vars`. Un test ne doit
  jamais dépendre de ce fichier local : fixer explicitement les bindings concernés
  (ex. `DEV_USER_EMAIL: undefined`).
- **Versions** : TypeScript reste en 6.x (`typescript-eslint` n'accepte pas TS 7), Vitest en 4.x
  (exigé par le plugin Cloudflare).
