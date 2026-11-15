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
- **Mode dev** : si `ACCESS_AUD` est absent et `DEV_USER_EMAIL` défini, cet e-mail est utilisé sans JWT. L'en-tête `x-dev-user-email` peut alors choisir un autre utilisateur (e2e à plusieurs utilisateurs) ; il est ignoré dès que `ACCESS_AUD` est défini.
- **Droits par voyage** :
  - le **propriétaire** (`trips.owner_email`) peut tout faire ;
  - un membre **`editor`** lit et modifie le voyage et ses jours, mais ne peut ni partager ni supprimer le voyage ;
  - un membre **`viewer`** lit seulement ;
  - un **non-membre** reçoit 404, pour ne pas révéler l'existence du voyage. Un membre sans le droit requis reçoit 403.
- **Partage** : géré par le propriétaire (`PUT` et `DELETE /api/trips/:id/members/:email`). L'invité doit aussi passer Cloudflare Access : la politique Access doit l'autoriser.

## 4. Schéma de données (D1)

| Migration        | Contenu                                          |
| ---------------- | ------------------------------------------------ |
| `0001_init.sql`  | Table technique `meta (key TEXT PK, value TEXT)` |
| `0002_trips.sql` | `trips`, `trip_members`, `days`                  |

- **`trips`** : `id` (UUID), `owner_email`, `name`, `start_date`, `end_date` (AAAA-MM-JJ), `day_start` et `day_end` (HH:mm, défauts 08:00 et 22:00), `default_timezone` (IANA), `hike_speed_kmh` (3.5), `version` (verrou optimiste), `created_at`, `updated_at`.
- **`trip_members`** : (`trip_id`, `email`) clé primaire, `role` (`viewer` | `editor`), `created_at`.
- **`days`** : `id`, `trip_id`, `date` (unique par voyage), `day_start` et `day_end` (NULL = heures du voyage), `notes`.

**Règles** :

- Les jours suivent la période du voyage : à la création, et à chaque changement de dates, les jours manquants sont créés et les jours hors période supprimés. Les jours conservés gardent leur identifiant et leurs notes.
- Un jour est **non vide** s'il a des notes. Le lot 2 étendra cette règle aux étapes, qui passeront alors dans la liste d'idées. Supprimer des jours non vides demande `?force=true`, sinon la réponse est `409 days_not_empty`.
- Durée maximale d'un voyage : 90 jours. Une journée doit finir après son début : la règle est vérifiée avec les valeurs existantes quand un seul des deux champs change.
- **Verrou optimiste** : toute modification du voyage ou d'un jour exige `If-Match: <version>` (428 sinon) et incrémente `trips.version`, dans la même transaction D1 que la modification. Une version périmée donne `409 { error: 'version_conflict', version }`. Les changements de membres ne changent pas la version.

Les tables `steps`, `stays`, `legs` et les caches arrivent aux lots suivants.

## 5. Surface API

| Méthode | Route                           | Droit        | Réponse                                           |
| ------- | ------------------------------- | ------------ | ------------------------------------------------- |
| GET     | `/api/health`                   | aucun        | `200 { ok: true }`                                |
| GET     | `/api/me`                       | connecté     | `200 { email }`                                   |
| GET     | `/api/trips`                    | connecté     | `200 { trips: TripSummary[] }` (avec rôle)        |
| POST    | `/api/trips`                    | connecté     | `201 TripSnapshot`                                |
| GET     | `/api/trips/:id`                | lecture      | `200 TripSnapshot` (voyage, rôle, jours, membres) |
| PATCH   | `/api/trips/:id[?force=true]`   | modification | `200 TripSnapshot` · `If-Match` obligatoire       |
| DELETE  | `/api/trips/:id`                | propriétaire | `204`                                             |
| PATCH   | `/api/trips/:id/days/:dayId`    | modification | `200 TripSnapshot` · `If-Match` obligatoire       |
| PUT     | `/api/trips/:id/members/:email` | propriétaire | `204` · corps `{ role }`                          |
| DELETE  | `/api/trips/:id/members/:email` | propriétaire | `204`                                             |

- **Erreurs** : `400 invalid` (avec `issues`) ou `invalid_json`, `401`, `403 forbidden`, `404 not_found`, `409 version_conflict` ou `days_not_empty`, `428 version_required`.
- Toute route `/api/*` autre que `/health` passe d'abord par l'authentification.
- Les schémas (`TripCreate`, `TripPatch`, `DayPatch`, `MemberPut`) et les types de réponse sont dans `packages/core`.

## 6. Intégrations externes

- **Carte** : MapLibre GL JS 6, avec deux fonds au choix.
  - **Plan** : OpenFreeMap, style Liberty (`https://tiles.openfreemap.org/styles/liberty`), sans clé et fourni sans garantie.
  - **Topo** : OpenTopoMap (tuiles raster).
  - Les URL sont centralisées dans `apps/web/src/lib/map/styles.ts`.
  - Le worker de MapLibre est émis par Vite et déclaré avec `setWorkerUrl`.

Prévues :

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
- **Fabrique `createApp({ auth })`** (`apps/api/src/app.ts`) : les tests d'API injectent une identité, et tournent sur la vraie D1 de workerd, migrations appliquées.
- **Pas de couleur stockée par voyage** (prévue dans le plan) : la teinte de la carte de voyage est dérivée de l'identifiant, ce qui évite un champ et un sélecteur sans valeur métier.

## 9. Limites connues et reste à faire

- **Déploiement** : Worker sur https://mytrips.dev-workshop-net.workers.dev, protégé par Access (« All traffic », politique « Cloudflare account », équipe `mytraces-pages.cloudflareaccess.com`), URL Preview désactivées. Pour que le partage fonctionne avec d'autres personnes, la politique doit devenir une liste d'e-mails (Zero Trust → Access → Applications).
- **`@vite-pwa/sveltekit` 2 très récent** (dépend d'`@unplugin-pwa` 0.0.x) : surveiller les mises à jour, et l'option `globStrict: false` rendue nécessaire par le motif `prerendered/**` ajouté d'office.
- **Migrations en production** : chaque nouvelle migration doit être appliquée (`pnpm --filter @mytrips/api db:migrate:remote`) **avant** de déployer le code qui l'utilise.
- **Carte** : sans étapes, la carte montre une vue d'ensemble de l'Europe ; le recentrage sur le voyage arrive avec les étapes (lot 2).
- **Lots restants** : 2. étapes ; 3. lieux ; 4. trajets ; 5. horaires ; 6. GPX ; 7. hors ligne.
