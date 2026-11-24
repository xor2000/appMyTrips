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
  `src/index.ts` exporte `createApp()` avec la session par cookie (`src/auth/`). Routes métier dans `src/routes/`, requêtes D1
  dans `src/db/`. Droits par voyage : middleware `access('read' | 'write' | 'owner')`. Bindings dans
  `src/env.ts`. Migrations D1 dans `migrations/`.
- `apps/web` : SvelteKit 3 en SPA (`ssr = false`, `adapter-static` avec `fallback: 'index.html'`).
  Configuration SvelteKit **dans `vite.config.ts`** (via `withPwa`), il n'y a pas de `svelte.config.js`.
- `e2e` : parcours Playwright.

## Conventions

- **Cible : desktop et tablette uniquement.** Pas de travail d'adaptation pour téléphone : une
  application mobile distincte viendra plus tard (réutilisant `packages/core`).
- Interface, messages et commentaires en **français** ; identifiants de code en anglais.
- TypeScript strict (`noUncheckedIndexedAccess`). Svelte 5 avec runes (`$props`, `$state`, `$derived`).
- Tests : `*.test.ts` à côté du code (core, web) ou dans `apps/api/test/`. Noms de tests en français.
  TDD : écrire les tests d'abord et les voir échouer.
- Styles : uniquement via les variables CSS. `apps/web/src/lib/styles/tokens.css` (polices,
  rayons, espacements) et un fichier par thème dans `styles/themes/` (couleurs et variables de
  forme : `pastel.css` clair et sombre, `carnet.css`). Pas de couleur en dur dans les composants ;
  un nouveau thème ne doit demander qu'un fichier CSS (plus son entrée dans `lib/theme.ts` et
  `app.html`).
- Dépendances en version exacte (`.npmrc` : `save-exact=true`).
- Pas de secret dans le dépôt : `wrangler secret put` en production, `apps/api/.dev.vars` en local.

## Pièges connus

- **Service worker uniquement en build** : jamais actif en `vite dev`. Tester la PWA avec
  `pnpm build` puis `wrangler dev` (c'est ce que font les e2e). Il ne contrôle la page qu'au
  chargement suivant son installation : un e2e hors ligne attend `navigator.serviceWorker.ready`,
  recharge, puis vérifie `navigator.serviceWorker.controller` avant `context.setOffline(true)`.
- **IndexedDB et état Svelte** : un objet `$state` est un proxy, qu'IndexedDB ne sait pas cloner
  (« could not be cloned »). Toujours enregistrer `$state.snapshot(valeur)`.
- **SvelteKit 3** : l'alias `$lib` n'existe plus. Utiliser `#lib/...` (champ `imports` de
  `apps/web/package.json`) **avec l'extension** pour les modules TS : `import { x } from '#lib/api.ts'`.
- **`@vite-pwa/sveltekit` 2** : API `withPwa(configKit, optionsPwa)`. Options Workbox sous `generateSW`
  (l'ancienne clé `workbox` est dépréciée). Le plugin ajoute toujours le motif `prerendered/**`, d'où
  `globStrict: false`. Le manifeste est lié en dur dans `src/app.html`.
- **Tests du Worker** : `@cloudflare/vitest-plugin` (l'ancien `@cloudflare/vitest-pool-workers` est
  déprécié). Appeler le Worker avec `exports.default.fetch()` de `cloudflare:workers` (`SELF` est
  déprécié). Le typage passe par `Cloudflare.GlobalProps.mainModule` dans `apps/api/test/env.d.ts`.
  Premier appel lent (démarrage de workerd) : `testTimeout` de 20 s, paquets testés un par un.
- **Authentification maison** (`apps/api/src/auth/`, `routes/auth.ts`) : aucun contournement de
  développement. En local, `.dev.vars` doit définir `AUTH_SECRET` (et `ADMIN_EMAILS`) ; on crée son
  compte sur `/connexion`. Toute écriture `/api` exige un en-tête `Origin` de la même origine (CSRF).
- **Routes publiques** : `/api/health` et les routes de `publicAuthRoutes` (captcha, inscription,
  connexion, déconnexion, réinitialisation) sont montées **avant** `sessionAuth()` dans `app.ts`.
- **Partage** : uniquement par lien d'invitation. `PUT /members/:email` ne fait que changer le rôle d'un
  membre existant ; dans les tests d'API, ajouter un membre avec `addMember()` de `test/helpers.ts`.
- **Front et 401** : `setUnauthorizedHandler` (layout) renvoie un `401 unauthorized` vers
  `/connexion?suite=…`. Une erreur métier ne doit donc jamais répondre 401 (mauvais mot de passe
  actuel : `400 wrong_password`).
- **Tests d'API** : utiliser `call(user, method, path, body?, headers?)` de `apps/api/test/helpers.ts`
  (identité par en-tête `x-test-user`, vraie D1, migrations appliquées par `test/apply-migrations.ts`).
  L'isolation du stockage entre tests n'est pas garantie : ne jamais supposer une base vide (filtrer
  sur ses propres données).
- **Paramètres de chemin Hono** : `c.req.param()` renvoie la valeur **déjà décodée**. Ne pas rappeler
  `decodeURIComponent` (un `%` ferait planter la route).
- **Verrou optimiste** : toute écriture sur un voyage ou ses objets passe par `writeWithVersion`
  (`apps/api/src/routes/trips.ts`) : version incrémentée et requêtes conditionnées dans un seul
  `db.batch`.
- **Marqueurs HTML de MapLibre** : MapLibre les place par un `transform` en ligne. Jamais de
  `transition` ni de `transform` en CSS sur l'élément du marqueur (il traîne derrière la carte) ;
  mettre en évidence avec la propriété `scale`. Pour des points nombreux, préférer une couche
  WebGL (source GeoJSON, `setFeatureState`), comme les lieux de la découverte (`lib/map/pois.ts`).
- **`map.isStyleLoaded()`** reste faux tant que des tuiles chargent : une mise à jour de source
  ou de couche conditionnée par lui doit être reportée (`whenStyleReady` de `TripMap.svelte`,
  à l'événement `idle`), sinon elle est perdue.
- **MapLibre 6** : son worker doit être déclaré explicitement
  (`import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')` puis `setWorkerUrl`), sinon il est
  cherché à côté du chunk et le Worker Cloudflare renvoie le fallback HTML. L'e2e « la carte charge
  son web worker sans erreur » le vérifie.
- **E2E** :
  - base D1 locale dédiée (`apps/api/.wrangler/e2e`), **effacée puis migrée à chaque démarrage**
    (accumulée, la liste des voyages finissait par dépasser les délais) ; noms de voyages uniques
    (`uniqueName`), les tests tournant en parallèle sur la même base ;
  - fenêtre de 1280 × 900 : un glisser-déposer ne doit jamais demander de défilement (Playwright
    fait défiler jusqu'à la cible pendant le glisser et Chromium perd alors le dépôt) ;
  - machine chargée (autres serveurs) : délais dépassés en série ; relancer avec `--workers=1` ;
  - ports 8788 / 8798 déjà pris par une autre copie du projet : `reuseExistingServer` lance alors
    les tests contre son serveur (page `{"error":"not_found"}`, setup en échec) ; choisir d'autres
    ports avec `E2E_PORT` et `E2E_MOCK_PORT` ;
  - tuiles de carte interceptées (style vide) ;
  - compte principal `dev@example.test` connecté par le projet `setup` (`e2e/auth.setup.ts`), session
    réutilisée par `storageState` (`e2e/.auth/`, ignoré par git) ;
  - autre utilisateur : `anonymousContext(browser)` puis `signupViaUi` (`e2e/auth-helpers.ts`) ; un
    `browser.newContext()` hérite sinon de la session du projet ;
  - chaque contexte envoie sa propre IP fictive (`CF-Connecting-IP`, que `wrangler dev` laisse passer) :
    les bannissements et la limite de 5 inscriptions par IP et par heure ne gênent pas les autres tests ;
  - `getByLabel` fait une recherche partielle insensible à la casse : utiliser `{ exact: true }`
    pour des libellés courts (« Du » correspond aussi à « Nom du voyage »).
    De même pour les boutons : toute fenêtre (`Modal`) a une croix « Fermer la fenêtre », donc
    `getByRole('button', { name: 'Fermer', exact: true })` ;
  - plus de page d'accueil : `page.goto('/')` redirige vers le dernier voyage consulté (ou l'écran
    « Aucun voyage »). On change de voyage par la liste déroulante « Choisir un voyage » de
    l'en-tête ; le nom du voyage reste un `<h1>` (réservé aux lecteurs d'écran) pour les attentes.
- **Écritures sur un voyage (front)** : toujours passer par `apply()` de la page voyage (file
  `createSerialQueue`) et lire la version au moment de l'exécution (`() => updateStep(id, …, version(), …)`).
  Deux écritures rapprochées avec la même version donnent un faux conflit.
- **Zones de dépôt** (`DropZone.svelte`) : hauteur fixe. Une zone qui grandit pendant un glisser décale
  la liste sous le curseur et le dépôt tombe ailleurs (constaté en e2e).
- **Clés de `{#each}`** : jamais construites à partir de données externes supposées uniques (Photon
  renvoie parfois deux fois le même lieu). Une clé en double lève `each_key_duplicate` et SvelteKit
  affiche sa page d'erreur 500.
- **E2E et services externes** : Photon et Overpass sont appelés par le Worker, pas par le
  navigateur (une interception Playwright ne les voit pas). Playwright lance des services factices
  (`e2e/mock-services.mjs`, port 8798) et passe `PHOTON_URL` et `OVERPASS_URLS` à `wrangler dev`.
  Après un glisser-déposer, attendre que le résultat soit affiché avant l'action suivante.
- **Ajout d'un trajet (timeline « Liste »)** : sans trajet, la barre « + trajet » est masquée et
  sans `pointer-events` hors survol. En e2e, survoler la tuile (`tile.hover()`) avant de cliquer un
  mode, sinon le clic n'atteint jamais le bouton.
- **Taille d'affichage** (`zoom` CSS sur `<html>`, 80 / 90 / 100 %) : une coordonnée de la carte
  (`__mapProjectForTests`) est en pixels de la carte ; pour cliquer à l'écran, la multiplier par
  `largeur affichée du canevas / offsetWidth` (voir `clickMapAt` de `e2e/poi.spec.ts`).
- **URL de base des services externes** : construire les URL par concaténation
  (`${base}/api/v5/plan`), jamais `new URL('/chemin', base)`, qui efface le chemin de la base (relais,
  services factices des e2e sous `/osrm`, `/transitous`…).
- **Routage en test** : `vitest.config.ts` fixe `OSRM_URL` sur une adresse injoignable : un test qui
  crée un trajet sans fetch factice obtient une estimation, jamais un appel au vrai OSRM. Les tests du
  routage passent `OSRM_URL: undefined` et leur propre fetch (`routeCaller` de `test/legs.test.ts`).
- **Trajets** (`apps/api/src/routes/legs.ts`) : toute écriture qui change l'ordre ou les jours des
  étapes doit finir par `pruneStaleLegs` (fait par `snapshot()` dans `routes/steps.ts` et par le
  PATCH du voyage). Le front n'affiche que les trajets des paires requises (`dayPairs`).
- **Travail lourd côté navigateur** : le Worker gratuit n'a que 10 ms de CPU par requête. Un calcul
  coûteux sur des données de l'utilisateur (ex. analyse GPX, `core/gpx`) se fait dans le navigateur
  avec le même code `core`, et l'API n'en valide que le résultat.
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
  chaque `wrangler deploy` réactive les URL Preview (autres versions du Worker sur la base de production).
- **`.dev.vars` et tests** : `@cloudflare/vitest-plugin` charge `apps/api/.dev.vars`. Un test ne doit
  jamais dépendre de ce fichier local : fixer explicitement les bindings concernés
  (ex. `AUTH_SECRET` et `ADMIN_EMAILS` dans `vitest.config.ts`).
- **Versions** : TypeScript reste en 6.x (`typescript-eslint` n'accepte pas TS 7), Vitest en 4.x
  (exigé par le plugin Cloudflare).
