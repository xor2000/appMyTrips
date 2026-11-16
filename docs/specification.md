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
- **Découverte** : bouton « Explorer » de la carte. On coche des catégories (restaurants, musées…), les
  lieux de la zone visible s'affichent en liste et en marqueurs, et s'ajoutent en un clic au jour
  sélectionné ou aux idées.
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

| Migration            | Contenu                                          |
| -------------------- | ------------------------------------------------ |
| `0001_init.sql`      | Table technique `meta (key TEXT PK, value TEXT)` |
| `0002_trips.sql`     | `trips`, `trip_members`, `days`                  |
| `0003_steps.sql`     | `steps` (étapes et dossiers), `stays` (séjours)  |
| `0004_poi_cache.sql` | `poi_cache` (cache de la découverte de lieux)    |
| `0005_legs.sql`      | `legs` (trajets), `route_cache` (itinéraires)    |

- **`trips`** : `id` (UUID), `owner_email`, `name`, `start_date`, `end_date` (AAAA-MM-JJ), `day_start` et `day_end` (HH:mm, défauts 08:00 et 22:00), `default_timezone` (IANA), `hike_speed_kmh` (3.5), `version` (verrou optimiste), `created_at`, `updated_at`.
- **`trip_members`** : (`trip_id`, `email`) clé primaire, `role` (`viewer` | `editor`), `created_at`.
- **`days`** : `id`, `trip_id`, `date` (unique par voyage), `day_start` et `day_end` (NULL = heures du voyage), `notes`.
- **`steps`** : étapes et dossiers.
  - Placement : `id`, `trip_id`, `day_id` (NULL = liste d'idées), `parent_id` (dossier), `position` (clé d'ordre fractionnaire parmi les frères), `kind` (`step` | `group`).
  - Contenu : `type` (16 types, NULL pour un dossier), `name`, `lat`/`lng` (NULL pour un dossier), `address`, `exit_lat`/`exit_lng` (point de sortie, NULL = entrée), `duration_min`, `fixed_start` (HH:mm), `timezone` (IANA, déduit du point), `opening_hours`, `osm_ref`, `booking_ref`, `booking_url`, `notes`.
- **`poi_cache`** : `key` (`<catégorie>:13:<x>:<y>`, case de carte au zoom 13), `payload` (lieux normalisés, JSON), `source` (`overpass` | `geoapify`), `created_at`. Valable 7 jours.
- **`stays`** : séjours. `id`, `trip_id`, `name`, `lat`, `lng`, `address`, `check_in_date`/`check_in_time` (défaut 17:00), `check_out_date`/`check_out_time` (défaut 10:00), `booking_ref`, `notes`.

**Règles** :

- Les jours suivent la période du voyage : à la création, et à chaque changement de dates, les jours manquants sont créés et les jours hors période supprimés. Les jours conservés gardent leur identifiant et leurs notes.
- Un jour est **non vide** s'il a des notes ou des étapes. Supprimer des jours non vides demande `?force=true`, sinon la réponse est `409 days_not_empty` ; avec `force`, leurs étapes (dossiers compris) passent dans la liste d'idées et leurs notes sont perdues.
- **Ordre** : clés fractionnaires (`fractional-indexing`) comparées comme des chaînes ; un déplacement ne réécrit que l'élément déplacé. Égalité départagée par l'identifiant.
- **Dossiers** : un seul niveau. Un dossier est à la racine d'un jour (ou des idées) ; ses étapes sont du même jour. Déplacer un dossier de jour emporte ses étapes ; changer une étape de jour sans préciser de dossier la sort de son dossier. Supprimer un dossier non vide exige `?children=keep` (ses étapes reprennent sa place, dans l'ordre) ou `?children=delete`.
- **Séjours** : non stockés jour par jour. Un séjour couvre les nuits de `check_in_date` à `check_out_date` (exclu). Le matin d'un jour dont la nuit précédente est couverte, il apparaît en « départ » (ou « check-out » le dernier jour) ; le soir d'un jour dont la nuit suivante est couverte, en « retour » (ou « check-in » le premier jour). Clé d'occurrence : `stay:<id>:<date>:start|end`.
- **Timeline d'un jour** (`core.dayTimeline`) : séjour du matin, racines triées (dossiers avec leurs étapes triées), séjour du soir. `core.dayRoute` l'aplatit en points d'entrée/sortie pour la carte et les trajets (lot 4).
- Durée maximale d'un voyage : 90 jours. Une journée doit finir après son début : la règle est vérifiée avec les valeurs existantes quand un seul des deux champs change.
- **Verrou optimiste** : toute modification du voyage ou d'un jour exige `If-Match: <version>` (428 sinon) et incrémente `trips.version`, dans la même transaction D1 que la modification. Une version périmée donne `409 { error: 'version_conflict', version }`. Les changements de membres ne changent pas la version.

- **`legs`** : trajets. `id`, `trip_id`, `from_key` et `to_key` (clé d'étape ou d'occurrence de séjour ; unique par voyage), `mode` (`car`, `bike`, `walk`, `bus`, `train`, `plane`, `ferry`), `distance_m` (NULL si inconnue), `duration_min`, `distance_source` et `duration_source` (`router`, `estimate` ou `manual`), `geometry` (polyligne encodée, précision 5), `summary` (lignes empruntées), `depart_at` (HH:mm fixé), `booking_ref`, `notes`, `computed_at`.
- **`route_cache`** : `key` (mode, points arrondis à 5 décimales, tranche horaire pour bus et train), `payload` (`RouteResult`), `created_at`. Valable 30 jours, 6 h pour bus et train. Seuls les calculs des fournisseurs sont mis en cache (pas les estimations, ni l'avion et le ferry, calculés localement).

**Trajets** :

- Un trajet est **requis** entre deux points consécutifs d'un jour (`core.requiredLegs`, sur `dayRoute` : dossiers aplatis, séjours compris). Il part du point de sortie de l'étape précédente et arrive au point d'entrée de la suivante. Tant qu'il manque, une tuile « + trajet » s'affiche.
- **Trajet caduc** : après toute écriture sur les étapes, les séjours ou la période, les trajets dont la paire n'est plus consécutive sont supprimés (`pruneStaleLegs`), juste après l'écriture et conditionnés à la version. Le front propose de **reprendre** un trajet saisi à la main ainsi retiré (« Reprendre : Voiture 45 min ») sur une tuile vide qui touche l'une de ses étapes.
- **Lieu déplacé** : changer le point d'une étape ou d'un séjour retire, dans la même transaction, ses trajets calculés ; ceux qui contiennent une saisie manuelle sont gardés.
- **Saisie manuelle** : une durée saisie est gardée ; une distance saisie seule donne une durée à la vitesse moyenne du mode (voiture 60 km/h, vélo 15, marche 4,5, bus 30, train 80, avion 750, ferry 30) ; « Recalculer » revient au routeur. Sans itinéraire, la durée saisie suffit (distance inconnue).
- **Départ des bus et trains** : heure fixée du trajet, sinon fin de l'étape précédente si son heure est fixe, sinon 09:00 (départ d'un séjour : heure du check-out), dans le fuseau de l'étape de départ. Le moteur d'horaires (lot 5) affinera.

## 5. Surface API

| Méthode | Route                                        | Droit        | Réponse                                                                                   |
| ------- | -------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| GET     | `/api/health`                                | aucun        | `200 { ok: true }`                                                                        |
| GET     | `/api/me`                                    | connecté     | `200 { email }`                                                                           |
| GET     | `/api/trips`                                 | connecté     | `200 { trips: TripSummary[] }` (avec rôle)                                                |
| POST    | `/api/trips`                                 | connecté     | `201 TripSnapshot`                                                                        |
| GET     | `/api/trips/:id`                             | lecture      | `200 TripSnapshot` (voyage, rôle, jours, membres, étapes, séjours)                        |
| PATCH   | `/api/trips/:id[?force=true]`                | modification | `200 TripSnapshot` · `If-Match` obligatoire                                               |
| DELETE  | `/api/trips/:id`                             | propriétaire | `204`                                                                                     |
| PATCH   | `/api/trips/:id/days/:dayId`                 | modification | `200 TripSnapshot` · `If-Match` obligatoire                                               |
| PUT     | `/api/trips/:id/members/:email`              | propriétaire | `204` · corps `{ role }`                                                                  |
| DELETE  | `/api/trips/:id/members/:email`              | propriétaire | `204`                                                                                     |
| POST    | `/api/trips/:id/steps`                       | modification | `201 TripSnapshot` · `If-Match` · position absente = fin de liste                         |
| PATCH   | `/api/trips/:id/steps/:stepId`               | modification | `200 TripSnapshot` · `If-Match` · champs et déplacement (`dayId`, `parentId`, `position`) |
| DELETE  | `/api/trips/:id/steps/:stepId[?children=keep | delete]`     | modification                                                                              | `200 TripSnapshot` · `If-Match` |
| POST    | `/api/trips/:id/stays`                       | modification | `201 TripSnapshot` · `If-Match`                                                           |
| PATCH   | `/api/trips/:id/stays/:stayId`               | modification | `200 TripSnapshot` · `If-Match`                                                           |
| DELETE  | `/api/trips/:id/stays/:stayId`               | modification | `200 TripSnapshot` · `If-Match`                                                           |
| GET     | `/api/geocode?q=&lat=&lng=`                  | connecté     | `200 { results: Place[] }` (Photon, biais vers lat/lng)                                   |
| GET     | `/api/geocode/reverse?lat=&lng=`             | connecté     | `200 { result: Place                                                                      | null }`                         |
| GET     | `/api/poi?bbox=O,S,E,N&zoom=&categories=a,b` | connecté     | `200 { pois: Poi[], source }` (zone visible, zoom ≥ 12, 40 cases au plus)                 |
| GET     | `/api/poi/wiki?ref=`                         | connecté     | `200 { summary }` (`ref` : `Q123` ou `langue:titre` ; `summary` : `WikiSummary` ou null)  |
| POST    | `/api/trips/:id/legs`                        | modification | `201 TripSnapshot` · `If-Match` · remplace le trajet de la même paire                     |
| PATCH   | `/api/trips/:id/legs/:legId`                 | modification | `200 TripSnapshot` · `If-Match` · `null` remet au routeur, `recompute: true`              |
| DELETE  | `/api/trips/:id/legs/:legId`                 | modification | `200 TripSnapshot` · `If-Match`                                                           |
| POST    | `/api/route`                                 | connecté     | `200 { route: RouteResult }` · corps `{ mode, from, to, departAt? }`                      |

- **Erreurs** : `400 invalid` (avec `issues`), `invalid_json`, `invalid_day`, `invalid_parent`, `children_mode_required`, `invalid_query`, `invalid_coordinates`, `invalid_bbox`, `invalid_zoom`, `invalid_categories`, `zoom_too_low`, `area_too_large`, `invalid_ref`, `invalid_leg` ; `401` ; `403 forbidden` ; `404 not_found` ; `409 version_conflict` ou `days_not_empty` ; `422 no_route` ; `428 version_required` ; `502 geocoder_unavailable` ou `wiki_unavailable` ; `503 poi_unavailable`.
- Toute route `/api/*` autre que `/health` passe d'abord par l'authentification.
- Les schémas (`TripCreate`, `TripPatch`, `DayPatch`, `MemberPut`, `StepCreate`, `StepPatch`, `StayCreate`, `StayPatch`) et les types de réponse (`Step`, `Stay`, `Place`…) sont dans `packages/core`.

## 6. Intégrations externes

- **Carte** : MapLibre GL JS 6, avec deux fonds au choix.
  - **Plan** : OpenFreeMap, style Liberty (`https://tiles.openfreemap.org/styles/liberty`), sans clé et fourni sans garantie.
  - **Topo** : OpenTopoMap (tuiles raster).
  - Les URL sont centralisées dans `apps/web/src/lib/map/styles.ts`.
  - Le worker de MapLibre est émis par Vite et déclaré avec `setWorkerUrl`.

- **Géocodage** : Photon (Komoot), appelé par le Worker (`/api/geocode`), en français, User-Agent identifié sans donnée personnelle. URL configurable par la variable `PHOTON_URL` (défaut `https://photon.komoot.io`). Le type d'étape est deviné depuis les tags OSM (`core.stepTypeFromOsm`).
- **Fuseau horaire** : déduit du point à l'enregistrement d'une étape (`@photostructure/tz-lookup`, côté Worker).

- **Découverte de lieux** (`/api/poi`, logique pure dans `packages/core/src/poi`) :
  - **9 catégories** (`POI_CATEGORIES`) avec leurs tags OSM, leurs catégories Geoapify et leur type d'étape ;
  - **Overpass** en premier : instances de `OVERPASS_URLS` (défaut `overpass-api.de`, puis `overpass.private.coffee`), requête QL `nwr[...]["name"](bbox); out center tags;`, POST avec User-Agent identifié ;
  - **Geoapify** (API Places v2, 500 lieux au plus par appel) en **secours** si toutes les instances échouent : HTTP en erreur (dont 429), réseau, délai de 8 s dépassé, ou réponse tronquée (`remark` contenant « error »). Seulement si le secret `GEOAPIFY_API_KEY` est défini ; chaque secours est tracé dans les journaux du Worker ;
  - **cache D1** par case de zoom 13 et catégorie, 7 jours ; seules les cases manquantes sont demandées, en une requête sur la zone qui les couvre ;
  - **classement** : lieux avec article Wikipédia d'abord, puis distance au centre ; 200 lieux au plus par catégorie ; lieux sans nom ignorés ; liens non http(s) écartés ;
  - **Wikipédia** : résumé et vignette par l'API REST (`/page/summary`), chargés à la sélection d'un lieu. Avec un identifiant Wikidata, article français sinon anglais. La langue d'un tag `wikipedia` est strictement validée (elle devient un sous-domaine).
- **Ajout d'un lieu découvert** : étape pré-remplie (nom, type, point, adresse, horaires d'ouverture, `osm_ref`) ; site, téléphone et cuisine dans les notes. Un lieu dont l'`osm_ref` est déjà dans le voyage est marqué « Déjà ajouté ».

- **Routage** (`apps/api/src/routing/providers.ts`, `POST /api/route` et création des trajets) :
  - **voiture, vélo, marche** : OpenRouteService (`https://api.heigit.org/openrouteservice`, l'ancien domaine `api.openrouteservice.org` est fermé), profils `driving-car`, `cycling-regular`, `foot-walking`, clé `ORS_API_KEY` dans l'en-tête `Authorization`. Sans clé, ou en erreur (401, 403, 429, 5xx, réseau, délai de 10 s) : **estimation locale** (grand cercle × 1,3 à la vitesse du mode, en ligne droite), marquée « estimé ». Un 404 d'ORS signifie qu'aucune route n'existe : `422 no_route` ;
  - **bus, train** : Transitous (MOTIS 2, `GET /api/v5/plan`, polylignes en précision 6). Itinéraire le plus court, puis le moins de correspondances ; lignes résumées (`displayName`, ex. « TER 17611 »). Aucun itinéraire : `422 no_route` ; erreur du service : estimation locale ;
  - **avion** : grand cercle, distance ÷ 750 km/h + 30 min, tracé en arc ; **ferry** : grand cercle à 30 km/h ;
  - User-Agent `MyTrips/0.1 (+<CONTACT_URL>)` : la politique de Transitous exige un moyen de contact, un projet open source publié et un usage non commercial ;
  - les URL de base (`ORS_URL`, `TRANSITOUS_URL`, comme `PHOTON_URL` et `GEOAPIFY_URL`) peuvent contenir un chemin (relais, services factices des e2e) ;
  - mentions « openrouteservice.org (HeiGIT) » et « Transitous » (lien vers `transitous.org/sources`) dans l'attribution de la carte.

Secrets : `ORS_API_KEY` (recommandé, sinon voiture, vélo et marche sont estimés), `GEOAPIFY_API_KEY` (facultatif, secours de la découverte). Variable : `CONTACT_URL` (URL du projet publié, pour Transitous).

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
- **Glisser-déposer HTML5 natif** (plutôt que `svelte-dnd-action` prévu dans le plan) : zones de dépôt imbriquées simples (jour, dossier, onglet de jour, idées) et e2e fiables avec Playwright ; complété par des actions monter/descendre et le choix du jour dans l'éditeur.
- **Cache de la découverte au zoom 13** (plutôt que 14 prévu dans le plan) : au zoom 12 minimal, la zone visible couvre une vingtaine de cases du zoom 13, sous le plafond de 40 ; au zoom 14, il en faudrait plus de 60.
- **Overpass factice pour les e2e** (plutôt qu'une interception Playwright prévue dans le plan) : Overpass est appelé par le Worker, comme Photon.
- **Nettoyage des trajets caducs juste après l'écriture** (le plan prévoyait la même transaction) : il faudrait sinon recalculer la timeline de l'état futur avant d'écrire. Conditionné à la version, il ne supprime rien si une autre écriture est passée entre-temps (elle fait alors son propre nettoyage) ; le front n'affiche de toute façon que les trajets des paires requises.
- **Calcul des trajets côté Worker** : le front n'envoie que la paire et le mode ; le Worker retrouve les points, l'heure de départ estimée et le fuseau.
- **Estimation locale sans clé ORS ou en erreur** (le plan prévoyait un message d'erreur) : choix de l'utilisateur, la tuile affiche « estimé ».
- **Éditeur de trajet en fenêtre** (le plan prévoyait un panneau latéral) : même composant `Modal` que les autres éditeurs.
- **Site, téléphone et cuisine d'un lieu dans les notes** de l'étape : pas de colonne dédiée tant qu'aucun écran ne les exploite.
- **Écritures sérialisées côté front** (`createSerialQueue`) : deux actions rapprochées (deux glisser-déposer) partiraient sinon avec la même version du voyage, et la seconde serait refusée en conflit.

## 9. Limites connues et reste à faire

- **Déploiement** : Worker sur https://mytrips.dev-workshop-net.workers.dev, protégé par Access (« All traffic », politique « Cloudflare account », équipe `mytraces-pages.cloudflareaccess.com`), URL Preview désactivées. Pour que le partage fonctionne avec d'autres personnes, la politique doit devenir une liste d'e-mails (Zero Trust → Access → Applications).
- **`@vite-pwa/sveltekit` 2 très récent** (dépend d'`@unplugin-pwa` 0.0.x) : surveiller les mises à jour, et l'option `globStrict: false` rendue nécessaire par le motif `prerendered/**` ajouté d'office.
- **Migrations en production** : chaque nouvelle migration doit être appliquée (`pnpm --filter @mytrips/api db:migrate:remote`) **avant** de déployer le code qui l'utilise.
- **Migration `0005_legs.sql`** à appliquer en production avant de déployer le lot 4.
- **Trajets** :
  - **Transitous** : le dépôt doit être **public et sous licence open source** (politique d'usage), et `CONTACT_URL` défini, avant tout usage en production ;
  - **ORS non vérifié avec une vraie clé** (aucune clé) : sans elle, voiture, vélo et marche sont estimés ;
  - un dossier replié masque les tuiles de trajet de ses étapes ;
  - la proposition « Reprendre » ne vit que pendant la session (non stockée) ;
  - les couleurs des tracés sont lues au moment du dessin : un changement de thème ne les met à jour qu'au prochain changement des trajets.
- **Découverte de lieux** :
  - les instances publiques d'Overpass étaient **saturées** lors du contrôle manuel du 16/11/2026 (`overpass-api.de` : « at capacity », `overpass.private.coffee` : plus de 25 s) ; sans clé Geoapify, la découverte répond alors 503. Fournisseurs réels **non vérifiés** de bout en bout ;
  - la correspondance des catégories Geoapify n'a pas été vérifiée sur l'API réelle (pas de clé) ;
  - Geoapify renvoie 500 lieux au plus par appel : une zone dense peut être mise en cache incomplète ;
  - le cache n'est jamais purgé (une ligne expirée n'est remplacée que si sa case est redemandée).
- **E2E `smoke` du service worker** : instable en exécution parallèle complète, y compris sur `main` (relance nécessaire, précache d'environ 2,2 Mo) ; passe en isolé. Piste : allonger son délai ou le sortir du lot parallèle.
- **Ranger une étape dans un dossier** ne se fait qu'au glisser-déposer (pas d'équivalent clavier ; monter/descendre et changer de jour ont le leur).
- **Suppression** : confirmée, mais sans annulation avant le lot 5.
- **Géocodage** : Photon est fourni sans garantie ; certains lieux reviennent en type « Autre » (tags OSM non reconnus) : l'utilisateur peut imposer le type à l'ajout ou le changer ensuite.
- **Lots restants** : 5. horaires ; 6. GPX ; 7. hors ligne.
