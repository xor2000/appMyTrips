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
- **Affichages de la journée** (`lib/layout.ts`), au choix sur « Mon compte » (`LayoutPicker`) ou par le sélecteur rapide de la page voyage (`LayoutSwitch`), mémorisé par appareil (`localStorage`, `mytrips.layout`) ; les trois sont maintenus et ont la même édition (ajout, modification, suppression, trajets, dossiers, idées, glisser-déposer) :
  - **Liste et carte** (`list`, par défaut) : timeline verticale à gauche, carte à droite (panneau redimensionnable) ;
  - **Ligne de métro** (`metro`, `MetroLine`, `MetroStop`) : carte en haut, journée en ligne horizontale dessous (stations avec heure de début en avant ; trajets compacts `MetroLeg` posés sur la ligne comme des stations, durée au-dessus, mode et distance dessous, clic pour modifier, « + » qui se déplie pour choisir le mode ; dossiers encadrés, zones de dépôt verticales de largeur fixe, plus tôt / plus tard), idées à droite ;
  - **Plein écran** (`board`) : bascule Carte / Timeline ; la timeline montre tous les jours en colonnes (composant `Timeline` de la liste, dépôt avec le jour de la colonne, ajouts dans la colonne), idées en dernière colonne.
  - Socle commun : `lib/trips/dayViews.ts` (`buildDayViews` : éléments, paires de trajets, horaires et numéros de chaque jour), mêmes fenêtres d'édition et mêmes actions de la page voyage.
- **Carte** : étapes numérotées du jour (ou « J2 » en vue d'ensemble), séjours « H », et **idées** qui ont un lieu, marquées d'une ampoule (marqueur clair à contour pointillé, nom accessible « Idée · … », sans numéro ni trajet : les tracés ne relient que des étapes placées). Le cadrage suit les étapes placées ; les idées ne servent qu'à défaut.
- **Hors ligne** : consultation en lecture seule des voyages déjà ouverts (ou préparés), carte de leur zone comprise ; l'édition se fait en ligne.
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

| Binding      | Type   | Usage                                                                                |
| ------------ | ------ | ------------------------------------------------------------------------------------ |
| `ASSETS`     | Assets | Build du front                                                                       |
| `DB`         | D1     | Données (base `mytrips`)                                                             |
| R2 (`FILES`) | —      | Non utilisé : R2 n'est pas activé sur le compte (le GPX original n'est pas conservé) |

**PWA** :

- `@vite-pwa/sveltekit` 2 (`withPwa`) en stratégie `generateSW` ;
- précache des fichiers client et de la coquille `index.html` ;
- la navigation hors ligne retombe sur `index.html`, sauf `/api/*` ;
- enregistrement avec invite de mise à jour (`registerType: 'prompt'`, composant `UpdatePrompt`) ;
- invite d'installation (`beforeinstallprompt`, composant `InstallPrompt`) sur la liste des voyages ;
- manifeste `manifest.webmanifest` lié dans `app.html`.

**Hors ligne** (lot 7) :

- **Données** : copie IndexedDB (`idb-keyval`, `lib/offline/store.ts`) de la liste des voyages et de chaque instantané ouvert, avec sa date, mise à jour à chaque chargement et à chaque modification réussie ; un voyage ouvert après la liste y est ajouté. Hors ligne (ou sur échec réseau), la page se charge depuis cette copie (`loadWithFallback`) ; une erreur de l'API (404, 403) n'est jamais masquée par la copie. Le moteur d'horaires recalcule tout localement.
- **Connexion** (`lib/offline/connection.svelte.ts`) : `navigator.onLine`, événements `online`/`offline`, échec réseau d'un appel. Hors ligne : bandeau « Hors ligne · consultation seule · données du JJ/MM à HH:mm » et lecture seule (même mécanisme que le rôle `viewer`, découverte de lieux masquée). Au retour du réseau, les données sont rechargées.
- **Service worker** (stratégies runtime de Workbox, `vite.config.ts`) : style, sprites, polices et TileJSON d'OpenFreeMap en `StaleWhileRevalidate` ; tuiles OpenFreeMap en `CacheFirst` (`ofm-tiles`, 20 000 au plus, 60 jours) ; tuiles OpenTopoMap en `CacheFirst` (5 000 au plus) ; vignettes Wikipédia et photos de couverture (`upload.wikimedia.org`, `thumb.wikimedia.org`) en `CacheFirst` (500 au plus). Les réponses de `/api` ne sont **pas** mises en cache par le service worker.
- **« Préparer hors ligne »** (outils de la carte) : emprise de chaque jour (`core.tripBboxes` : étapes, sorties, tracés GPX et de trajets, séjours, marge de 10 %) ; tuiles des zooms 6 à 14 sans doublon (`core.planOfflineTiles`), plafond de 4 000 tuiles (zoom maximal abaissé au-delà) ; estimation à 25 Ko par tuile ; préchargement à la demande seulement, 4 requêtes en parallèle au plus, avec barre de progression ; polices (plages 0–1023) et sprites du style aussi. `navigator.storage.persist()` est demandé ; l'espace utilisé est affiché, « Libérer » retire du cache les tuiles propres au voyage. Le statut « Disponible hors ligne » s'affiche sur la carte du voyage dans la liste.

**Design** : direction « Pastel ludique » par défaut, alignée sur la maquette de l'étude initiale (artifact « MyTrips — étude », direction C), et thème « Carnet clair » (direction A).

- Tokens communs dans `apps/web/src/lib/styles/tokens.css` : polices, rayons (8 / 12 / 18 / 22 px), espacements.
- **Accueil** (`routes/+page.svelte`, `lib/home.ts`) : voyage en cours, sinon prochain départ, mis en avant (`NextTrip` : photo 1280 px, compte à rebours ou « J2 sur 3 », chiffres, lieux) ; puis « En cours et à venir » et « Souvenirs » (voyages passés, photo désaturée). Cartes photo (`TripCard`) : nom sur la photo, pastille d'état (« Dans 12 jours », « En cours · jour 2 », « Terminé »), jours, étapes et distance, trois premiers lieux, crédit. Sans photo : teinte stable du voyage (`lib/trips/tint.ts`). Le texte posé sur les photos utilise les variables `--photo-*`, identiques dans tous les thèmes.
  - **Photo automatique** (`lib/covers.ts`) : à l'affichage de l'accueil en ligne, chaque voyage sans photo que l'utilisateur peut modifier reçoit la première photo trouvée, un voyage après l'autre ; sans mot-clé ni résultat, il n'est plus cherché sur cet appareil (`localStorage`, `mytrips.coverTried`) ; une erreur réseau ou un conflit de version ne marque rien.
  - **Changer la photo** : section « Photo du voyage » de « Modifier le voyage » (`CoverPicker`, recherche libre, photos numérotées dans l'ordre de la recherche, « Sans photo »).
  - La liste hors ligne est calculée depuis le voyage complet (`summaryFromSnapshot`) et une copie plus ancienne est complétée au chargement (`normalizeTripSummary`).
- **Thèmes** : un fichier CSS par thème dans `lib/styles/themes/`, qui définit couleurs et variables de forme sous `[data-theme='…']` (sélecteur valable sur `<html>` comme sur un élément, pour les aperçus). Aucune couleur en dur dans les composants.
  - `pastel.css` : Pastel ludique, sans attribut (clair ou sombre selon le système), `pastel-light` ou `pastel-dark` ; neutres vert d'eau (`--bg` #f6f8f8, `--line` #dde6e7, `--fg` #14282b), accent sarcelle, couleurs par type d'étape, texte sur aplat (`--on-type`, `--on-warn`, `--on-bad`), ombres, voile des fenêtres (`--scrim`).
  - `carnet.css` : Carnet clair (`carnet`), cartes blanches à filet fin, icônes teintées, trajets en bandes grises, rayons plus petits. Clair uniquement.
  - Variables de forme lues par les composants : `--card-tint`, `--card-edge`, `--card-lift`, `--card-radius`, `--icon-tint`, `--icon-ink`, `--icon-radius`, `--leg-tint`, `--leg-base`, `--leg-radius`, `--leg-icon-tint`, `--leg-icon-ink`, `--tab-radius`, `--btn-radius`, `--group-edge-style`, `--group-edge`, `--group-radius`. Ce sont des **pourcentages ou des valeurs simples**, jamais des expressions contenant `var(--c)` : une variable définie sur `<html>` y serait calculée sans la couleur de la carte. Les composants font le mélange (`color-mix(in srgb, var(--c) var(--card-tint), var(--surface))`).
  - Choix sur « Mon compte » (`ThemePicker`) : Automatique, Pastel ludique clair, Pastel ludique sombre, Carnet clair ; mémorisé par appareil (`localStorage`, clé `mytrips.theme`, `lib/theme.ts`). Un script en ligne de `app.html` pose `data-theme` avant le premier affichage (liste et clé vérifiées par `theme.test.ts`).
- Polices Outfit (titres), Inter (texte) et JetBrains Mono (horaires, distances), auto-hébergées via `@fontsource-variable` pour fonctionner hors ligne.
- Page voyage, panneau gauche (fond `--surface`) : en-tête du jour séparé par un filet (date, « 08:00 → 22:00 · 14 h », barre sur place / trajets / libre / dépassement en sarcelle / orange / vert / rouge avec légende chiffrée, bandeau orange à bouton plein « Réorganiser ») ; puis la timeline.
- Timeline d'un jour : cartes sur toute la largeur ; horaire façon agenda à droite de la carte (début en gros, « → fin » dessous, début en rouge en cas de conflit ; texte lu « début → fin », visuel `aria-hidden`), heure du dossier dans son en-tête ; pastilles à côté du nom ; actions (monter, descendre, supprimer) en surimpression au survol, à gauche sur l'icône. Ligne pointillée verticale au milieu des cartes, visible entre les étapes ; trajets en pilule et temps libre centrés dessus, sur fond plein ; le temps libre avant une étape (5 min ou plus) est une pastille verte à contour pointillé avec un sablier (« 1 h 55 de temps libre »). Trajet centré en hauteur entre deux étapes (`--leg-offset` en édition, pour compenser la zone de dépôt). Un dossier se comporte comme une étape : le trajet de sa dernière étape vers la suite s'affiche après le dossier, pas dedans. Ajout : bouton pointillé « + Ajouter un lieu », les autres ajouts en petits boutons.
- Carte : une seule pilule d'outils en haut à droite (Plan, Topo, Explorer, Préparer hors ligne) et, pour un éditeur, un champ « Rechercher un lieu, une adresse… » en haut à gauche qui ouvre « Ajouter un lieu » (ou « Ajouter une idée » sur « Tout le voyage »).

## 3. Authentification et droits

Authentification faite maison (issue #19), sans Cloudflare Access. Code dans `apps/api/src/auth/` et `apps/api/src/routes/auth.ts`, schémas dans `packages/core/src/auth/schemas.ts`.

- **Comptes** (`users`) : l'identifiant est l'e-mail, en minuscules (`trips.owner_email` et `trip_members.email` y renvoient : un compte créé avec l'adresse d'un ancien utilisateur Access retrouve ses voyages). Mot de passe de 10 à 128 caractères.
- **Mots de passe** (`auth/password.ts`) :
  - PBKDF2-SHA256 (WebCrypto), sel aléatoire de 16 octets, empreinte de 32 octets ;
  - format versionné `pbkdf2-sha256$<itérations>$<sel>$<empreinte>` (base64url) ;
  - **5000 répétitions** : le Worker gratuit n'a que 10 ms de CPU par requête (mesuré dans workerd : 5000 ≈ 6,3 ms, 10 000 ≈ 11,3 ms). Une empreinte plus faible que `PASSWORD_ITERATIONS` est recalculée à la connexion suivante : il suffira d'augmenter la constante (Workers Paid) ;
  - compte inconnu : une empreinte factice est vérifiée, pour que la durée et la réponse soient celles d'un mauvais mot de passe.
- **Sessions** (`auth/session.ts`, table `sessions`) :
  - jeton aléatoire de 32 octets ; seule son empreinte SHA-256 est stockée ;
  - cookie `__Host-session` : `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sans `Domain` ;
  - 30 jours glissants (prolongation écrite une fois par jour au plus) ;
  - déconnexion : session supprimée, cookie effacé. Changer de mot de passe ferme les autres sessions ; une réinitialisation les ferme toutes.
- **CSRF** (`sameOrigin`) : toute requête `/api` autre que GET, HEAD ou OPTIONS doit porter un en-tête `Origin` dont l'hôte est celui de la requête (`Host`), sinon `403 bad_origin`. S'ajoute à `SameSite=Lax`.
- **Inscription libre et captcha fait maison** (`auth/captcha.ts`) :
  - question « Combien font a + b ? » (a et b de 1 à 9) ;
  - jeton `charge.signature` : la charge (base64url) porte un identifiant et l'expiration (10 minutes) ; la signature est un HMAC-SHA256 (secret `AUTH_SECRET`) de la charge et de la réponse attendue, qui n'apparaît donc pas en clair ;
  - usage unique (`captcha_used`) : un jeton bien formé et non expiré est consommé dès sa première présentation, même avec une mauvaise réponse ;
  - c'est un frein, pas une protection : les limites et le bannissement sont la vraie défense.
- **Bannissement d'IP** (`auth/limits.ts`, `ip_bans`) :
  - 3 échecs de connexion depuis une même IP (`CF-Connecting-IP`) en 15 minutes : IP bannie jusqu'à réactivation par un admin ;
  - une IP bannie reçoit `403 ip_banned` sur la connexion, le captcha, l'inscription et la réinitialisation ; les sessions déjà ouvertes continuent ;
  - une connexion réussie remet à zéro les échecs de l'IP et de l'e-mail ;
  - en production, Cloudflare remplace tout `CF-Connecting-IP` envoyé par le client ; en local, `wrangler dev` le laisse passer (les e2e s'en servent pour isoler leurs tests).
- **Autres limites** (`auth_attempts`, purgées après 24 h) : 5 échecs par e-mail en 15 minutes, toutes IP confondues ; 5 inscriptions par IP et par heure. Au-delà : `429 too_many_attempts`.
- **Administration** :
  - administrateurs = e-mails de `ADMIN_EMAILS` (séparés par des virgules, sans casse) ; routes `/api/admin/*` (sinon `403 forbidden`) ;
  - page `/admin` : lien de réinitialisation du mot de passe (24 h, usage unique, `password_resets`), liste des IP bannies (date, dernier e-mail tenté, échecs) et réactivation ;
  - commandes de secours, sans session (`wrangler d1 execute`) : `pnpm --filter @mytrips/api run reset-link <email>` et `pnpm --filter @mytrips/api run unban-ip <ip>` (option `--local` pour la base locale). Leur SQL (`scripts/sql.mjs`) est testé dans le runtime Workers.
- **Routes publiques** : `/api/health` et `/api/auth/{captcha,signup,login,logout,reset/:token}`, montées avant `sessionAuth`. Toutes les autres exigent une session (`401 unauthorized`).
- **Front** :
  - pages `/connexion` (onglets connexion et inscription ; retour à `?suite=` ensuite, chemin interne seulement : `lib/auth/next.ts`), `/invitation/[token]`, `/reinitialisation/[token]`, `/compte` (changer de mot de passe, se déconnecter), `/admin` ;
  - en-tête : e-mail (lien vers `/compte`) et lien « Administration » pour un admin ;
  - un `401 unauthorized` de l'API (`setUnauthorizedHandler`) renvoie vers `/connexion?suite=<page>` ; un `401 invalid_credentials` (mauvais identifiants) non ;
  - hors ligne (état de session inconnu), la page reste affichée : les copies sont consultables sans session ;
  - la déconnexion efface les copies hors ligne de l'appareil (IndexedDB).
- **Droits par voyage** :
  - le **propriétaire** (`trips.owner_email`) peut tout faire ;
  - un membre **`editor`** lit et modifie le voyage et ses jours, mais ne peut ni partager ni supprimer le voyage ;
  - un membre **`viewer`** lit seulement ;
  - un **non-membre** reçoit 404, pour ne pas révéler l'existence du voyage. Un membre sans le droit requis reçoit 403.
- **Partage par lien d'invitation** (`routes/invitations.ts`, table `invitations`) :
  - le propriétaire crée un lien secret (rôle lecture ou modification, 7 jours, usage unique, stocké haché) ;
  - la personne qui l'ouvre, connectée ou après inscription, voit le voyage proposé puis l'accepte : elle devient membre sous son e-mail (consommation du lien et ajout dans un même lot D1) ;
  - plus d'ajout direct par e-mail : une inscription avec l'adresse de quelqu'un d'autre ne donne accès à rien. `PUT /members/:email` ne change que le rôle d'un membre existant (`404 not_member` sinon) ; retirer un membre reste possible.

## 4. Schéma de données (D1)

| Migration             | Contenu                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `0001_init.sql`       | Table technique `meta (key TEXT PK, value TEXT)`                                                  |
| `0002_trips.sql`      | `trips`, `trip_members`, `days`                                                                   |
| `0003_steps.sql`      | `steps` (étapes et dossiers), `stays` (séjours)                                                   |
| `0004_poi_cache.sql`  | `poi_cache` (cache de la découverte de lieux)                                                     |
| `0005_legs.sql`       | `legs` (trajets), `route_cache` (itinéraires)                                                     |
| `0006_gpx.sql`        | colonnes GPX des étapes (randonnées)                                                              |
| `0007_auth.sql`       | `users`, `sessions`, `invitations`, `password_resets`, `auth_attempts`, `ip_bans`, `captcha_used` |
| `0008_trip_cover.sql` | `trips.cover`, `cover_cache` (photos de couverture)                                               |

- **`trips`** : `id` (UUID), `owner_email`, `name`, `start_date`, `end_date` (AAAA-MM-JJ), `day_start` et `day_end` (HH:mm, défauts 08:00 et 22:00), `default_timezone` (IANA), `hike_speed_kmh` (3.5), `cover` (photo de couverture, JSON `TripCover` ou NULL), `version` (verrou optimiste), `created_at`, `updated_at`.
- **`trip_members`** : (`trip_id`, `email`) clé primaire, `role` (`viewer` | `editor`), `created_at`.
- **`days`** : `id`, `trip_id`, `date` (unique par voyage), `day_start` et `day_end` (NULL = heures du voyage), `notes`.
- **`steps`** : étapes et dossiers.
  - Placement : `id`, `trip_id`, `day_id` (NULL = liste d'idées), `parent_id` (dossier), `position` (clé d'ordre fractionnaire parmi les frères), `kind` (`step` | `group`).
  - Contenu : `type` (17 types dont `parking`, NULL pour un dossier), `name`, `lat`/`lng` (NULL pour un dossier), `address`, `exit_lat`/`exit_lng` (point de sortie, NULL = entrée), `duration_min`, `fixed_start` (HH:mm), `timezone` (IANA, déduit du point), `opening_hours`, `osm_ref`, `booking_ref`, `booking_url`, `notes`.
- **`cover_cache`** : `query` (`v2:` + mots-clés en minuscules ; la version écarte les recherches enregistrées avant le passage aux vignettes standard), `payload` (photos trouvées, JSON, éventuellement vide), `created_at`. Valable 30 jours ; une réponse en erreur n'y entre pas.
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
- **Randonnées GPX** (colonnes de `steps`, `0006`) : `gpx_stats` (JSON : `distanceM`, `ascentM`, `descentM`, `minEle`, `maxEle`, `isLoop`, `pointCount`), `gpx_track` (JSON : `[[lat, lng, ele|null], …]`, 500 points au plus), `use_elevation`, `duration_manual`.
- **`route_cache`** : `key` (mode, points arrondis à 5 décimales, tranche horaire pour bus et train), `payload` (`RouteResult`), `created_at`. Valable 30 jours, 6 h pour bus et train. Seuls les calculs des fournisseurs sont mis en cache (pas les estimations, ni l'avion et le ferry, calculés localement).

**Trajets** :

- Un trajet est **requis** entre deux points consécutifs d'un jour (`core.requiredLegs`, sur `dayRoute` : dossiers aplatis, séjours compris). Il part du point de sortie de l'étape précédente et arrive au point d'entrée de la suivante. Tant qu'il manque, une tuile « + trajet » s'affiche.
- **Trajet caduc** : après toute écriture sur les étapes, les séjours ou la période, les trajets dont la paire n'est plus consécutive sont supprimés (`pruneStaleLegs`), juste après l'écriture et conditionnés à la version. Le front propose de **reprendre** un trajet saisi à la main ainsi retiré (« Reprendre : Voiture 45 min ») sur une tuile vide qui touche l'une de ses étapes.
- **Lieu déplacé** : changer le point d'une étape ou d'un séjour retire, dans la même transaction, ses trajets calculés ; ceux qui contiennent une saisie manuelle sont gardés.
- **Saisie manuelle** : une durée saisie est gardée ; une distance saisie seule donne une durée à la vitesse moyenne du mode (voiture 60 km/h, vélo 15, marche 4,5, bus 30, train 80, avion 750, ferry 30) ; « Recalculer » revient au routeur. Sans itinéraire, la durée saisie suffit (distance inconnue).
- **Départ des bus et trains** : heure fixée du trajet, sinon fin de l'étape de départ selon les horaires calculés du jour (moteur ci-dessous), dans le fuseau de cette étape.

**Randonnées GPX** (`core/gpx`) :

- **Analyse dans le navigateur** (`prepareGpx`, `fast-xml-parser`) : le Worker gratuit n'a que 10 ms de CPU par requête (un GPX de 4,8 Mo et 50 000 points prend environ 1,7 s). L'API reçoit `{ stats, track }` (`GpxData`, validé par Zod) ; le fichier original n'est pas conservé.
- **Lecture** : `trk/trkseg/trkpt` (segments concaténés dans l'ordre), sinon `rte/rtept` ; nom de la trace, sinon des métadonnées, sinon du fichier ; 10 Mo au plus, XML valide, au moins 2 points.
- **Statistiques** : distance en haversine cumulée ; D+ et D− sur des altitudes lissées (moyenne glissante sur 5 points) avec un seuil de 3 m ; sans altitude sur au moins la moitié des points, dénivelé inconnu ; boucle si départ et arrivée à moins de 200 m.
- **Tracé simplifié** : Ramer–Douglas–Peucker jusqu'à 500 points au plus, départ et arrivée conservés.
- **Points** : le premier point du tracé devient l'entrée de l'étape (`lat`/`lng`), le dernier sa sortie (`exit_lat`/`exit_lng`) ; le trajet suivant part de la sortie.
- **Durée** : distance ÷ `hike_speed_kmh` (3,5 km/h par défaut), plus 1 h par 600 m de D+ si l'option est cochée, arrondie aux 5 min. Une durée saisie devient manuelle (`duration_manual`) ; changer l'option dénivelé recalcule et repasse en automatique.
- **Import** : bouton « Importer une randonnée (GPX) », ou fichier glissé sur la timeline du jour ; dans l'éditeur d'une randonnée : importer, remplacer ou retirer le GPX. Remplacer ou retirer le tracé déplace les points : les trajets calculés adjacents sont retirés.
- **Affichage** : pastilles « GPX 12,4 km » et « D+ 620 m », profil altimétrique (SVG) dans l'éditeur, tracé vert sur la carte, marqueur d'arrivée « ⚑ » quand ce n'est pas une boucle.

**Horaires** (`core.scheduleDay`, en minutes et en heure locale avec Luxon, fuseau toujours explicite) :

- Départ au début du jour (`day_start` du jour, sinon du voyage : `resolveDayBounds`), puis on enchaîne arrivée, fin de l'étape (arrivée + durée), trajet, etc. ; dossiers aplatis, séjours compris (durée 0).
- **Heure fixe = ancre** : arrivée en avance = temps libre ; en retard = **conflit** avec le retard en minutes ; l'étape commence à son heure fixe dans les deux cas. Même règle pour le départ fixé d'un trajet (`depart_at`).
- **Fuseaux** : l'arrivée d'un trajet s'exprime dans le fuseau de l'étape d'arrivée ; « +1 j » au-delà de minuit. Un séjour prend le fuseau de l'étape voisine, sinon celui du voyage ; fuseau inconnu = UTC.
- **Dépassement** : fin de la dernière activité (ou arrivée au séjour du soir) après `day_end`.
- **Trajet manquant** : compté 0 min et signalé ; le calcul continue.
- **Dossier** : du début de son premier enfant à la fin du dernier.
- Résultat : `start`, `end`, `freeBeforeMin`, `issues` par élément et par trajet ; résumé du jour (sur place, trajets, libre, dépassement, conflits, retard total, trajets manquants). Calculé côté front à chaque changement (`$derived`), et côté Worker pour le départ des bus et trains.

**Réorganisation** (`core.proposeFixes`) : chaque règle est simulée par le moteur ; seules les propositions qui réduisent « retard + dépassement » sont gardées, triées par gain, 4 au plus.

1. Raccourcir les étapes souples avant la première ancre en conflit, en proportion de leur marge (jamais sous 50 % de leur durée ni sous 15 min).
2. Avancer le début du jour (2 h au plus, par pas de 5 min).
3. Déplacer une étape souple (la plus courte qui suffit, sinon la plus longue) vers le jour qui a le plus de temps disponible, sinon vers les idées.
4. Permuter deux étapes souples adjacentes si les trajets connus du nouvel ordre sont plus courts (pas de proposition sans durées connues).
5. Dépassement : retarder la fin du jour (23:59 au plus), ou reporter la dernière étape souple au lendemain.

Une proposition s'applique par un **lot atomique** (`POST /api/trips/:id/batch`) : modifications d'étapes (`StepPatch`) et de jours (`DayPatch`), toutes validées avant d'écrire, en une seule version ; trajets caducs nettoyés ensuite.

**Annuler / rétablir** (Ctrl+Z, Ctrl+Y ou Ctrl+Maj+Z, boutons de l'en-tête) : pile côté front (`lib/schedule/history.ts`). Chaque commande garde ses opérations de lot et leurs inverses, calculés sur l'état avant application. Périmètre : modifications d'étape, déplacements (glisser-déposer, monter/descendre, changement de jour), propositions de réorganisation. La pile est vidée après un conflit de version et au changement de voyage. Les raccourcis ne s'appliquent pas dans un champ de saisie ni dans une fenêtre.

## 5. Surface API

| Méthode | Route                                        | Droit        | Réponse                                                                                   |
| ------- | -------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| GET     | `/api/health`                                | aucun        | `200 { ok: true }`                                                                        |
| GET     | `/api/me`                                    | connecté     | `200 { email, isAdmin }`                                                                  |
| GET     | `/api/auth/captcha`                          | aucun        | `200 { question, token }`                                                                 |
| POST    | `/api/auth/signup`                           | aucun        | `201 Me` + cookie · `{ email, password, captcha: { token, answer } }`                     |
| POST    | `/api/auth/login`                            | aucun        | `200 Me` + cookie · `{ email, password }`                                                 |
| POST    | `/api/auth/logout`                           | aucun        | `204`, cookie effacé                                                                      |
| POST    | `/api/auth/reset/:token`                     | aucun        | `204` · `{ password }` · ferme toutes les sessions                                        |
| POST    | `/api/auth/password`                         | connecté     | `204` · `{ current, next }` · ferme les autres sessions                                   |
| POST    | `/api/trips/:id/invitations`                 | propriétaire | `201 { token, role, expiresAt }` · `{ role }`                                             |
| GET     | `/api/invitations/:token`                    | connecté     | `200 { tripId, tripName, ownerEmail, role }`                                              |
| POST    | `/api/invitations/:token/accept`             | connecté     | `200 { tripId }`                                                                          |
| POST    | `/api/admin/resets`                          | admin        | `201 { token, expiresAt }` · `{ email }`                                                  |
| GET     | `/api/admin/bans`                            | admin        | `200 { bans: IpBan[] }`                                                                   |
| DELETE  | `/api/admin/bans/:ip`                        | admin        | `204`                                                                                     |
| GET     | `/api/trips`                                 | connecté     | `200 { trips: TripSummary[] }` (rôle, photo, `stepCount`, `distanceM`, `places`)          |
| POST    | `/api/trips`                                 | connecté     | `201 TripSnapshot`                                                                        |
| GET     | `/api/trips/:id`                             | lecture      | `200 TripSnapshot` (voyage, rôle, jours, membres, étapes, séjours)                        |
| PATCH   | `/api/trips/:id[?force=true]`                | modification | `200 TripSnapshot` · `If-Match` obligatoire                                               |
| DELETE  | `/api/trips/:id`                             | propriétaire | `204`                                                                                     |
| PATCH   | `/api/trips/:id/days/:dayId`                 | modification | `200 TripSnapshot` · `If-Match` obligatoire                                               |
| PUT     | `/api/trips/:id/members/:email`              | propriétaire | `204` · corps `{ role }` · membre existant seulement (`404 not_member`)                   |
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
| GET     | `/api/covers?q=`                             | connecté     | `200 { covers: TripCover[] }` (Commons, 8 au plus) · `400 invalid_query` · `502`          |
| POST    | `/api/trips/:id/legs`                        | modification | `201 TripSnapshot` · `If-Match` · remplace le trajet de la même paire                     |
| PATCH   | `/api/trips/:id/legs/:legId`                 | modification | `200 TripSnapshot` · `If-Match` · `null` remet au routeur, `recompute: true`              |
| DELETE  | `/api/trips/:id/legs/:legId`                 | modification | `200 TripSnapshot` · `If-Match`                                                           |
| POST    | `/api/route`                                 | connecté     | `200 { route: RouteResult }` · corps `{ mode, from, to, departAt? }`                      |
| POST    | `/api/trips/:id/batch`                       | modification | `200 TripSnapshot` · `If-Match` · `{ ops: BatchOp[] }` (1 à 50), atomique                 |
| PUT     | `/api/trips/:id/steps/:stepId/gpx`           | modification | `200 TripSnapshot` · `If-Match` · corps `{ gpx: GpxData }` (randonnée)                    |
| DELETE  | `/api/trips/:id/steps/:stepId/gpx`           | modification | `200 TripSnapshot` · `If-Match`                                                           |

- **Erreurs d'authentification** : `400 invalid_captcha`, `wrong_password`, `already_owner` ; `401 unauthorized` (sans session), `invalid_credentials` ; `403 bad_origin`, `ip_banned` ; `404 invalid_invitation`, `invalid_link`, `unknown_user`, `not_member` ; `409 email_taken` ; `429 too_many_attempts` ; `500 auth_not_configured` (`AUTH_SECRET` absent).
- **Erreurs** : `400 invalid` (avec `issues`), `invalid_json`, `invalid_day`, `invalid_parent`, `children_mode_required`, `invalid_query`, `invalid_coordinates`, `invalid_bbox`, `invalid_zoom`, `invalid_categories`, `zoom_too_low`, `area_too_large`, `invalid_ref`, `invalid_leg` ; `401` ; `403 forbidden` ; `404 not_found` ; `409 version_conflict` ou `days_not_empty` ; `422 no_route` ; `428 version_required` ; `502 geocoder_unavailable` ou `wiki_unavailable` ; `503 poi_unavailable`.
- Toute route `/api/*` passe d'abord par le contrôle d'origine (CSRF) ; toutes, sauf `/health` et les routes publiques de `/auth`, exigent ensuite une session.
- Les schémas (`TripCreate`, `TripPatch`, `DayPatch`, `MemberPut`, `StepCreate`, `StepPatch`, `StayCreate`, `StayPatch`) et les types de réponse (`Step`, `Stay`, `Place`…) sont dans `packages/core`.

## 6. Intégrations externes

- **Carte** : MapLibre GL JS 6, avec deux fonds au choix.
  - **Plan** : OpenFreeMap, style Liberty (`https://tiles.openfreemap.org/styles/liberty`), sans clé et fourni sans garantie.
  - **Topo** : OpenTopoMap (tuiles raster).
  - Les URL sont centralisées dans `apps/web/src/lib/map/styles.ts`.
  - **Défauts du style Liberty neutralisés** (même fichier, branchés dans `TripMap.svelte`) :
    - `guardMissingNumbers` (option `transformStyle` de la carte, reprise par chaque `setStyle`) : une comparaison numérique sur une propriété souvent absente (`["<=", ["get", "ref_length"], 6]` des panneaux de route, `rank`, `admin_level`) reçoit `["has", …]` devant elle. MapLibre consignait sinon un avertissement par tuile avant de retomber sur `false`. Seules les comparaisons à la racine du filtre ou dans des `all` sont protégées : sous `!` ou `any`, le résultat changerait ;
    - `missingImageResolver` (`setMissingStyleImageResolver`) : une icône absente du sprite d'OpenFreeMap (`sports_centre`, `gate`, `bollard`…) est remplacée par une image transparente de 1 × 1 px, sans avertissement.
  - Le worker de MapLibre est émis par Vite et déclaré avec `setWorkerUrl`.

- **Géocodage** : Photon (Komoot), appelé par le Worker (`/api/geocode`), en français, User-Agent identifié sans donnée personnelle. URL configurable par la variable `PHOTON_URL` (défaut `https://photon.komoot.io`). Le type d'étape est deviné depuis les tags OSM (`core.stepTypeFromOsm`).
- **Fuseau horaire** : déduit du point à l'enregistrement d'une étape (`@photostructure/tz-lookup`, côté Worker).

- **Découverte de lieux** (`/api/poi`, logique pure dans `packages/core/src/poi`) :
  - **9 catégories** (`POI_CATEGORIES`) avec leurs tags OSM, leurs catégories Geoapify et leur type d'étape ;
  - **Overpass** en premier : instances de `OVERPASS_URLS` (défaut `overpass-api.de`, puis `overpass.private.coffee`), requête QL `nwr[...]["name"](bbox); out center tags;`, POST avec User-Agent identifié ;
  - **Geoapify** (API Places v2, 500 lieux au plus par appel) en **secours** si toutes les instances échouent : HTTP en erreur (dont 429), réseau, délai de 4 s dépassé par instance (8 s pour Geoapify, dernier recours), ou réponse tronquée (`remark` contenant « error »). Seulement si le secret `GEOAPIFY_API_KEY` est défini ; chaque secours est tracé dans les journaux du Worker ;
  - **cache D1** par case de zoom 13 et catégorie, 7 jours ; seules les cases manquantes sont demandées, en une requête sur la zone qui les couvre ;
  - **classement** : lieux avec article Wikipédia d'abord, puis distance au centre ; 200 lieux au plus par catégorie ; lieux sans nom ignorés ; liens non http(s) écartés ;
  - **Wikipédia** : résumé et vignette par l'API REST (`/page/summary`), chargés à la sélection d'un lieu. Avec un identifiant Wikidata, article français sinon anglais. La langue d'un tag `wikipedia` est strictement validée (elle devient un sous-domaine).
- **Photos de couverture** (`/api/covers`, logique pure dans `packages/core/src/cover`) :
  - **Wikimedia Commons**, API `w/api.php` (recherche dans l'espace « Fichier », `filetype:bitmap`, `imageinfo` en 1280 px avec auteur et licence), par le Worker avec User-Agent identifié (plus `CONTACT_URL`) ; URL configurable par `COMMONS_URL` (défaut `https://commons.wikimedia.org`, services factices en e2e) ;
  - **filtre** : JPEG en paysage (rapport ≥ 1,2) d'au moins 1280 px, sans cartes, drapeaux, blasons ni logos (titre du fichier) ; 8 photos au plus, dans l'ordre de pertinence ; vignette **500 px** déduite de l'URL 1280 px (`fixCoverThumb`). Wikimedia ne sert que des largeurs standard (330, 500, 960, 1280 px…) : une autre largeur (640 px) répond 400, et une image de moins de 1280 px renverrait l'original, limité (429). Une vignette 640 px déjà enregistrée sur un voyage est corrigée à la lecture ;
  - **mots-clés** (`coverQuery`) : nom du voyage sans les mots génériques (« voyage », « test », « vacances », « week-end »…), les nombres ni les années ; à défaut, le premier lieu des étapes ;
  - **photo enregistrée** sur le voyage (`PATCH` avec `cover`) : images seulement de `upload.wikimedia.org` ou `thumb.wikimedia.org` (https), page de crédit sur `commons.wikimedia.org`, ou origine de `COMMONS_URL` ; sinon `400 invalid_cover` (une adresse quelconque permettrait à l'éditeur d'un voyage partagé de suivre ses lecteurs) ;
  - **crédit** affiché sous chaque photo (auteur, licence, lien vers la page du fichier).
- **Ajout d'un lieu découvert** : étape pré-remplie (nom, type, point, adresse, horaires d'ouverture, `osm_ref`) ; site, téléphone et cuisine dans les notes. Un lieu dont l'`osm_ref` est déjà dans le voyage est marqué « Déjà ajouté ».

- **Routage** (`apps/api/src/routing/providers.ts`, `POST /api/route` et création des trajets) :
  - **voiture, vélo, marche** : OpenRouteService (`https://api.heigit.org/openrouteservice`, l'ancien domaine `api.openrouteservice.org` est fermé), profils `driving-car`, `cycling-regular`, `foot-walking`, clé `ORS_API_KEY` dans l'en-tête `Authorization`. Sans clé, ou en erreur (401, 403, 429, 5xx, réseau, délai de 10 s) : **estimation locale** (grand cercle × 1,3 à la vitesse du mode, en ligne droite), marquée « estimé ». Un 404 d'ORS signifie qu'aucune route n'existe : `422 no_route` ;
  - **bus, train** : Transitous (MOTIS 2, `GET /api/v5/plan`, polylignes en précision 6). Itinéraire le plus court, puis le moins de correspondances ; lignes résumées (`displayName`, ex. « TER 17611 »). Aucun itinéraire : `422 no_route` ; erreur du service : estimation locale ;
  - **avion** : grand cercle, distance ÷ 750 km/h + 30 min, tracé en arc ; **ferry** : grand cercle à 30 km/h ;
  - User-Agent `MyTrips/0.1 (+<CONTACT_URL>)` : la politique de Transitous exige un moyen de contact, un projet open source publié et un usage non commercial ;
  - les URL de base (`ORS_URL`, `TRANSITOUS_URL`, comme `PHOTON_URL` et `GEOAPIFY_URL`) peuvent contenir un chemin (relais, services factices des e2e) ;
  - mentions « openrouteservice.org (HeiGIT) » et « Transitous » (lien vers `transitous.org/sources`) dans l'attribution de la carte.

Secrets : `AUTH_SECRET` (obligatoire : signature des captchas), `ORS_API_KEY` (recommandé, sinon voiture, vélo et marche sont estimés), `GEOAPIFY_API_KEY` (facultatif, secours de la découverte). Variables : `ADMIN_EMAILS` (administrateurs), `CONTACT_URL` (URL du projet publié, pour Transitous).

## 7. Contraintes non fonctionnelles

- Desktop uniquement pour l'instant (largeurs de 1280 px et plus), thèmes clair et sombre.
- Interface en français.
- Le service worker et le fallback SPA ne se comportent comme en production qu'en build : les e2e tournent sur le build servi par `wrangler dev`.

## 8. Décisions d'architecture

- **Un seul Worker** pour le front et l'API : même origine, cookie de session `__Host-`, pas de CORS.
- **SvelteKit 3** (au lieu de la 2 prévue dans le plan) : version stable depuis octobre 2026, exigée par `adapter-static` 4 et `@vite-pwa/sveltekit` 2.
- **TypeScript 6** : `typescript-eslint` n'accepte pas encore TS 7.
- **Vitest 4** : exigé par `@cloudflare/vitest-plugin`.
- **Tests du Worker dans le runtime workerd** (`@cloudflare/vitest-plugin`), pour exercer les vrais bindings (D1, puis R2 au lot 6).
- **Données en ligne d'abord** : D1 fait foi, hors ligne en lecture seule (lot 7).
- **Fabrique `createApp({ auth })`** (`apps/api/src/app.ts`) : les tests d'API injectent une identité (`x-test-user`), et tournent sur la vraie D1 de workerd, migrations appliquées. Les tests d'authentification (`test/auth-helpers.ts`) passent par la vraie session, chacun avec sa propre IP fictive.
- **Authentification faite maison plutôt que Cloudflare Access** (issue #19, choix de l'utilisateur) : comptes dans D1 ; PBKDF2 dimensionné aux 10 ms du Worker gratuit ; captcha fait maison plutôt que Turnstile ; partage par lien d'invitation plutôt que par e-mail (sans vérification d'e-mail, une inscription avec l'adresse d'un autre lui prendrait ses partages) ; réinitialisation par l'admin. Plus de contournement de développement (`DEV_USER_EMAIL` supprimé) : les e2e s'inscrivent vraiment.
- **`400 wrong_password`** (et non 401) pour un mauvais mot de passe actuel : le front renvoie tout `401 unauthorized` vers la connexion.
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
- **Pas de cache service worker pour `/api`** (le plan prévoyait `NetworkFirst`) : hors ligne, il servirait une ancienne réponse comme fraîche et sans date ; la copie IndexedDB, datée, suffit.
- **Pas d'option de zooms 15–16** : les tuiles vectorielles d'OpenFreeMap s'arrêtent au zoom 14, la carte les agrandit au-delà.
- **GPX sans R2** (choix de l'utilisateur, R2 n'étant pas activé) : statistiques, tracé simplifié et profil dans D1, sans le fichier original ni son téléchargement. R2 pourra s'ajouter sans changer le reste.
- **GPX analysé dans le navigateur** (le plan le prévoyait en repli) : limite CPU du Worker gratuit. `StepCreate` accepte directement `gpx`, en une écriture.
- **`fast-xml-parser`** (5.11.2, dans `core`) : parseur XML sans DOM, utilisable dans le navigateur et le Worker.
- **Luxon** (3.7.2, dans `core`) pour les heures locales et les fuseaux du moteur d'horaires : aucun calcul en `Date` natif sans fuseau.
- **Annuler / rétablir limité aux modifications et déplacements** (choix de l'utilisateur) : annuler une suppression demanderait de recréer l'objet avec un nouvel identifiant, et ses trajets seraient perdus. Créations et suppressions restent confirmées, sans annulation.
- **Logique d'écriture partagée** (`apps/api/src/routes/plans.ts` : `planStepUpdate`, `planDayUpdate`) par les routes unitaires et le lot atomique.
- **« Rechercher dans cette zone »** n'est reproposé qu'après un vrai déplacement de la carte (zoom d'au moins un demi-niveau, ou centre décalé de plus de 15 %) : un redimensionnement ne compte pas.

## 9. Limites connues et reste à faire

- **Déploiement** : Worker sur https://mytrips.dev-workshop-net.workers.dev, URL Preview désactivées. **Authentification maison en production depuis le 16/11/2026** (version `755e0b45`) : secrets `AUTH_SECRET` et `ADMIN_EMAILS`, migration `0007` appliquée, application Access supprimée ainsi que les secrets `ACCESS_*`. Seule l'authentification de l'application protège `/api` : vérifié de l'extérieur (`401` sans session, `403 bad_origin` sans `Origin`). Non vérifiés en production : attributs du cookie (vérifiés en e2e) et consommation CPU réelle.
- **Authentification** :
  - hachage limité par les 10 ms de CPU du Worker gratuit (5000 répétitions PBKDF2, bien moins que les recommandations actuelles) ; format prêt à être renforcé ;
  - deux calculs PBKDF2 dans une même requête (environ 12 ms mesurés en local) pour le changement de mot de passe (vérification puis nouvelle empreinte) et pour le renforcement d'une ancienne empreinte à la connexion : au-dessus de la limite nominale, non vérifié en production ;
  - IP partagée (4G, entreprise) : 3 erreurs d'une personne bloquent les autres jusqu'à la réactivation ; un admin banni se débloque par `unban-ip` ;
  - 5 échecs sur un e-mail le bloquent 15 minutes pour tout le monde (verrouillage possible par un tiers) ;
  - l'inscription révèle si un e-mail a déjà un compte (`409 email_taken`), ce qu'une inscription libre ne peut éviter ; le captcha et la limite par IP freinent l'énumération ;
  - pas d'envoi d'e-mail (vérification, mot de passe oublié en libre-service), pas de suppression ni de changement d'e-mail d'un compte, pas de double authentification, pas de jetons pour l'application mobile ;
  - les liens d'invitation non utilisés ne se listent ni ne se révoquent (ils expirent en 7 jours ; un membre ajouté par erreur se retire) ;
  - les sessions expirées et les invitations ou liens de réinitialisation périmés ne sont pas purgés de la base.
- **`@vite-pwa/sveltekit` 2 très récent** (dépend d'`@unplugin-pwa` 0.0.x) : surveiller les mises à jour, et l'option `globStrict: false` rendue nécessaire par le motif `prerendered/**` ajouté d'office.
- **Photos de couverture** : qualité inégale des premiers résultats de Commons (une photo d'un autre lieu au nom proche est possible ; « Changer la photo » y remédie) ; le cache `cover_cache` n'est jamais purgé ; une image qui ne charge plus (photo supprimée de Commons) est masquée et la teinte du voyage reprend, mais la photo reste enregistrée.
- **Migrations en production** : chaque nouvelle migration doit être appliquée (`pnpm --filter @mytrips/api db:migrate:remote`) **avant** de déployer le code qui l'utilise.
- **Trajets** :
  - **Transitous** : conditions de sa politique d'usage remplies le 16/11/2026 : dépôt public sous licence MIT, `CONTACT_URL` (URL du dépôt) dans les `vars` de `wrangler.jsonc`, lien vers ses sources dans l'attribution de la carte ;
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
- **Horaires** :
  - pas d'optimiseur global : les propositions sont des règles locales simulées ;
  - pas de conflit avec les horaires d'ouverture ;
  - la pile annuler/rétablir ne vit qu'en mémoire (perdue au rechargement) et ne couvre ni les créations, ni les suppressions, ni les trajets, ni les séjours ;
  - couverture de `core/schedule` non mesurée (pas d'outil de couverture installé) ;
  - deux modifications du même jour dans un lot sont validées chacune contre l'état en base, pas l'une contre l'autre.
- **E2E sous charge** : quand d'autres serveurs tournent sur la machine, des tests dépassent leurs délais (création de voyage) ; lancer alors `pnpm test:e2e -- --workers=1`.
- **Randonnées GPX** :
  - le fichier original n'est pas conservé (pas de R2) : pas de téléchargement ni de recalcul avec d'autres réglages de lissage ;
  - les statistiques viennent du navigateur ; l'API en valide la forme, pas l'exactitude ;
  - une durée annulée (Ctrl+Z) sur une randonnée reste marquée manuelle jusqu'au prochain changement de l'option dénivelé.
- **Hors ligne** :
  - pas d'édition hors ligne ni de synchronisation ; pas de routage, de recherche ni de découverte de lieux sans réseau ;
  - la carte hors ligne dépend d'OpenFreeMap : l'URL des tuiles est versionnée, une nouvelle version publiée après la préparation n'est pas en cache (il faut préparer de nouveau) ;
  - un quota dépassé pendant la mise en cache par le service worker n'est pas visible de la page ; seule une erreur `QuotaExceededError` remontée au navigateur affiche le message dédié ;
  - un voyage jamais ouvert sur l'appareil n'est pas consultable hors ligne ;
  - non vérifié à la main : consultation hors ligne de la vraie carte (tuiles réelles), PWA installée, mise à jour de l'application avec un voyage en cache.
- **Feuille de route** : tous les lots de l'épique #1 sont livrés.
