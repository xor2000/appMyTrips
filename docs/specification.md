# MyTrips — spécification

## 1. Contexte métier

MyTrips est une application web progressive (PWA) **desktop** pour organiser un voyage. Une application
mobile dédiée viendra plus tard et réutilisera la logique métier de `packages/core`.

- **Accueil** : la liste des voyages.
- **Page voyage** : à gauche, la timeline du jour ; à droite, la carte.
- **Jours** : un voyage a une période. Chaque jour contient des **étapes** dans l'ordre chronologique
  (hôtel, restaurant, musée, aéroport, monument, randonnée GPX…). Une étape est un point géographique
  avec un nom, un type, une durée sur place et éventuellement une **heure fixe**.
- **Dossiers** : des étapes peuvent être regroupées dans un dossier, affiché comme une étape parente.
- **Trajets** : un **trajet** est obligatoire entre deux étapes consécutives (voiture, vélo, marche,
  avion, bus, train, ferry), calculé par un routeur et modifiable à la main.
- **Horaires** : l'application calcule les horaires, signale les conflits et les dépassements de la
  journée, et propose des réorganisations.
- **Découverte** : recherche de lieux (restaurants, musées…) par catégorie dans la zone visible de la
  carte.
- **Hors ligne** : consultation en lecture seule ; l'édition se fait en ligne.
- **Partage** : un voyage peut être partagé en lecture seule ou en modification.

Feuille de route détaillée : épique #1 et ses lots (#2 à #9).

## 2. Architecture technique

Monorepo pnpm :

| Dossier         | Rôle                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| `apps/web`      | SvelteKit 3 + Svelte 5, SPA (`adapter-static`, fallback `index.html`), PWA Workbox  |
| `apps/api`      | Worker Cloudflare, Hono. API `/api/*`. Sert aussi le build du front (static assets) |
| `packages/core` | Logique métier pure en TypeScript (schémas Zod…), partagée front, API et mobile     |
| `e2e`           | Tests Playwright                                                                    |

**Déploiement** : un seul Worker (`mytrips`) sert le front et l'API sur la même origine.
`wrangler.jsonc` :

- `assets.directory = ../web/build` ;
- `not_found_handling = single-page-application` ;
- `run_worker_first = ["/api/*"]`.

**Bindings** :

| Binding      | Type   | Usage                                                             |
| ------------ | ------ | ----------------------------------------------------------------- |
| `ASSETS`     | Assets | Build du front                                                    |
| `DB`         | D1     | Données (base `mytrips`)                                          |
| R2 (`FILES`) | —      | Reporté au lot 6 (GPX) : R2 n'est pas encore activé sur le compte |

**PWA** :

- `@vite-pwa/sveltekit` 2 (`withPwa`) en stratégie `generateSW` ;
- précache des fichiers client et de la coquille `index.html` ;
- la navigation hors ligne retombe sur `index.html`, sauf `/api/*` ;
- enregistrement avec invite de mise à jour (`registerType: 'prompt'`, composant `UpdatePrompt`) ;
- manifeste `manifest.webmanifest` lié dans `app.html`.

**Design** : direction « Pastel ludique ».

- Tokens CSS dans `apps/web/src/lib/styles/tokens.css` : couleurs par type d'étape, rayons, ombres, thèmes clair et sombre.
- Polices Outfit (titres) et Inter (texte), auto-hébergées via `@fontsource-variable` pour fonctionner hors ligne.

## 3. Authentification et droits

- **Cloudflare Access** protège tout le Worker, avec une liste blanche d'e-mails dans la politique Access.
- **Middleware `accessAuth`** (`apps/api/src/auth.ts`) :
  - vérifie le JWT `Cf-Access-Jwt-Assertion` avec `jose` : JWKS distant `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`, émetteur `https://<ACCESS_TEAM_DOMAIN>`, audience `ACCESS_AUD`, algorithme RS256 uniquement ;
  - expose l'e-mail normalisé (minuscules) dans `c.get('userEmail')`.
- **Réponses d'erreur** :
  - `401 { error: 'unauthorized' }` : jeton absent, invalide, expiré, mauvais émetteur, mauvaise audience, mauvais algorithme ou sans e-mail ;
  - `500 { error: 'access_not_configured' }` : `ACCESS_AUD` ou `ACCESS_TEAM_DOMAIN` manquant hors mode dev.
- **Mode dev** : si `ACCESS_AUD` est absent et `DEV_USER_EMAIL` défini, cet e-mail est utilisé sans JWT.
- **Droits par voyage** (`trip_members`, rôles `viewer` et `editor`) : prévus au lot 1.

## 4. Schéma de données (D1)

| Migration       | Contenu                                          |
| --------------- | ------------------------------------------------ |
| `0001_init.sql` | Table technique `meta (key TEXT PK, value TEXT)` |

Les tables métier (`trips`, `trip_members`, `days`, `steps`, `stays`, `legs`, caches) arrivent aux
lots suivants.

## 5. Surface API

| Méthode | Route         | Auth   | Réponse                |
| ------- | ------------- | ------ | ---------------------- |
| GET     | `/api/health` | Aucune | `200 { ok: true }`     |
| GET     | `/api/me`     | Access | `200 { email }` ou 401 |

Toute autre route `/api/*` passe d'abord par le middleware : 401 sans identité, puis 404.

## 6. Intégrations externes

Aucune au lot 0. Prévues :

- OpenFreeMap et OpenTopoMap (tuiles) ;
- Photon (géocodage) ;
- OpenRouteService et Transitous (routage) ;
- Overpass, Geoapify et Wikipédia (lieux).

Secrets prévus : `ORS_API_KEY`, `GEOAPIFY_API_KEY`.

## 7. Contraintes non fonctionnelles

- Desktop uniquement pour l'instant (largeurs de 1280 px et plus), thèmes clair et sombre.
- Interface en français.
- Le service worker et le fallback SPA ne se comportent comme en production qu'en build : les e2e tournent sur le build servi par `wrangler dev`.

## 8. Décisions d'architecture

- **Un seul Worker** pour le front et l'API : même origine, une seule application Access, pas de CORS.
- **SvelteKit 3** (au lieu de la 2 prévue dans le plan) : version stable depuis octobre 2026, exigée par `adapter-static` 4 et `@vite-pwa/sveltekit` 2.
- **TypeScript 6** : `typescript-eslint` n'accepte pas encore TS 7.
- **Vitest 4** : exigé par `@cloudflare/vitest-plugin`.
- **Tests du Worker dans le runtime workerd** (`@cloudflare/vitest-plugin`), pour exercer les vrais bindings (D1, puis R2 au lot 6).
- **Données en ligne d'abord** : D1 fait foi, hors ligne en lecture seule (lot 7).

## 9. Limites connues et reste à faire

- **Déploiement** : Worker sur https://mytrips.dev-workshop-net.workers.dev, protégé par Access (« All traffic », politique « Cloudflare account », équipe `mytraces-pages.cloudflareaccess.com`), URL Preview désactivées. Pour partager un voyage (lot 1), la politique devra devenir une liste d'e-mails.
- **`@vite-pwa/sveltekit` 2 très récent** (dépend d'`@unplugin-pwa` 0.0.x) : surveiller les mises à jour, et l'option `globStrict: false` rendue nécessaire par le motif `prerendered/**` ajouté d'office.
- **Lots restants** :
  1. voyages et carte ;
  2. étapes ;
  3. lieux ;
  4. trajets ;
  5. horaires ;
  6. GPX ;
  7. hors ligne.
