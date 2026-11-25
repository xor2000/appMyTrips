# MyTrips — spécification

## 1. Contexte métier

MyTrips est une application web progressive (PWA) **desktop et tablette uniquement** pour organiser un
voyage. Les téléphones ne sont pas visés : une application mobile dédiée viendra plus tard et
réutilisera la logique métier de `packages/core`.

- **Pas de page d'accueil** : « / » ouvre le dernier voyage consulté ; les voyages se choisissent dans la liste déroulante de l'en-tête.
- **Page voyage** : à gauche, la timeline du jour ; à droite, la carte.
- **Jours** : un voyage a une période. Chaque jour contient des **étapes** dans l'ordre chronologique
  (hôtel, restaurant, musée, aéroport, monument, randonnée GPX…). Une étape est un point géographique
  avec un nom, un type, une durée sur place et éventuellement une **heure fixe**.
- **Dossiers** : des étapes peuvent être regroupées dans un dossier, affiché comme une étape parente, dans un jour ou dans les **idées** (pour les trier ; issue #47). Un dossier a une **icône** (« Dossier » par défaut, ou celle d'un des 17 types) et une **couleur** (« Automatique » : l'accent du thème, ou l'une des 8 couleurs des trajets), choisies dans `GroupDialog` (création et modification : nom, grille `.cat-grid`, pastilles `.swatches`) ; elles teintent son cadre et son icône (`--gc`, dans la liste comme dans la ligne de métro). Création par le bouton icône « Nouveau dossier » de l'en-tête du jour (à côté de la date, près de la barre du temps ; dans chaque colonne en plein écran) ou « Nouveau dossier d'idées » de l'en-tête des idées. Un clic sur le titre d'un dossier le replie ou le déplie ; on le modifie, le supprime ou le déplace par son menu contextuel. Les idées se glissent dans un dossier d'idées comme les étapes dans un dossier du jour.
- **Ajout d'un lieu** (issue #48) : un seul point d'entrée, le bouton « Lieu » de la pilule d'outils de la carte (icône `map-pin` et libellé, comme l'outil « Lieu » de la maquette de référence). L'ancien champ « Rechercher un lieu, une adresse… » de la carte, qui ouvrait la même fenêtre, est remplacé par l'outil « Rechercher » (25/11/2026, voir « Recherche »). Plus aucun bouton d'ajout sous les lieux du jour (« + Ajouter un lieu », « Ajouter un séjour », « Importer une randonnée (GPX) » retirés, dans les trois affichages), ni « Ajouter une idée ».
  1. Fenêtre « Ajouter un lieu » (`NewPlaceDialog`) : choix du lieu en trois onglets (`.seg`) : « Rechercher » (Photon, par défaut, focus sur la recherche), « Sur la carte » (la fenêtre se masque, bandeau et curseur en croix comme « Choisir sur la carte » ; absent quand la carte n'est pas affichée, en « Plein écran » sur la timeline), « Coordonnées » (latitude et longitude en degrés décimaux, ou un couple « 48.8584, 2.2945 » collé dans la latitude : `parseLatLng`, `lib/steps/coords.ts`). Un point pris sur la carte ou saisi est situé par géocodage inverse (`findPlaceAt` : nom, adresse et type du lieu le plus proche, sinon « Point sur la carte »).
  2. Fenêtre « Nouveau lieu » : l'éditeur d'étape en mode création (`StepEditor`, `mode="create"`), prérempli avec le lieu : nom, catégorie (type deviné), point, adresse, jour (le jour affiché, « Idées » sur « Tout le voyage »), durée (celle de la catégorie tant qu'elle n'est pas saisie), heure fixe, réservation, horaires, notes ; bouton « Ajouter », sans « Supprimer ». La grille des catégories y gagne **« Séjour »** (icône calendrier) : les champs deviennent ceux d'un séjour sur plusieurs nuits (arrivée le et à, départ le et à, 17:00 et 10:00 par défaut, arrivée le jour affiché, départ le lendemain ; réservation, notes) et « Ajouter » crée un séjour. « Randonnée » propose d'importer un GPX dès la création (analysé dans le navigateur, envoyé avec l'étape). Point déplacé dans la fenêtre : l'adresse devient celle du lieu le plus proche.
  - Un séjour existant se modifie toujours dans sa fenêtre (`StayDialog`, au clic sur sa carte) ; glisser un fichier GPX sur la timeline crée toujours une randonnée.
- **Trajets** : un **trajet** est facultatif entre deux étapes consécutives (voiture, vélo, marche,
  avion, bus, train, ferry), calculé par un routeur et modifiable à la main. Sans trajet,
  l'enchaînement compte 0 min, sans alerte.
- **Horaires** : l'application calcule les horaires, signale les conflits et les dépassements de la
  journée, et propose des réorganisations.
- **Découverte** : bouton « Explorer la zone » de la carte (issue #49). On coche des catégories (restaurants, musées…), ou toutes d'un coup par la pastille « Tous » (une seule recherche ; « Tous » de nouveau décoche tout) ; les lieux de la zone visible s'affichent en pastilles sur la carte et en liste, **groupés par catégorie** dans l'ordre de `POI_CATEGORIES` (`groupPoisByCategory`, `lib/poi/explore.ts`, mis en forme par `poiResultGroups`, `lib/places/results.ts`), chaque groupe sous un petit titre : icône du type, libellé, nombre, filet ; l'ordre de classement est gardé dans un groupe. Le groupe « Lieux trouvés » contient une liste par catégorie, nommée par son titre : seuls les lieux en sont les éléments. Lignes **sans bouton d'action** (25/11/2026) : clic gauche, zoom, popup et détail déplié (résumé Wikipédia, horaires, téléphone, site) ; clic droit, menu contextuel commun (voir « Recherche »). Choisir un lieu dans la liste ou la survoler ne met plus sa pastille en évidence : la popup le désigne ; seul le survol d'une pastille sur la carte l'agrandit.
- **Recherche** (25/11/2026) : outil « Rechercher » (loupe) de la pilule de la carte, en ligne, aussi en lecture seule. Il ouvre le panneau gauche à la place de la journée, comme « Explorer la zone » (un seul panneau à la fois, état `sidePanel` de la page, `SidePanel` commun avec « Retour au jour ») : champ « Rechercher un lieu » qui reçoit le focus, géocodage Photon biaisé vers le centre de la carte, dès 2 caractères avec anti-rebond (`PlaceSearch`, liste remplacée par le snippet `list`). Résultats **groupés par type d'étape** dans l'ordre de `STEP_TYPES` (`placeResultGroups`), titres et lignes identiques à ceux de la découverte (composants communs `ResultGroups` et `ResultRow`, `lib/components/places/`), pastille « Déjà ajouté » pour un lieu du voyage (même `osmRef`), doublons du géocodeur gardés (clé par position). Pas de pastilles sur la carte : le clic gauche sur un résultat cadre le lieu (`flyTo`, zoom 15 au moins, `FocusTarget` `place`) et ouvre la popup d'un lieu sous un clic droit (« Ajouter à J2 », « Ajouter aux idées », ou « Déjà ajouté » et « Supprimer ») ; la ligne reste en évidence tant que la popup est ouverte. **Menu contextuel commun** des résultats des deux panneaux (clic droit, touche Menu ou Maj+F10 ; `placeMenuEntries`, `lib/steps/contextMenu.ts`) : « Ajouter aux idées », « Ajouter à un jour » (sous-menu de tous les jours, avec leur date), « Voir dans Google Maps » ; un lieu déjà dans le voyage : « Supprimer » (confirmé) et Google Maps ; en lecture seule : Google Maps seul. Un lieu découvert ajouté garde ses horaires et notes (`poiStepInput`) ; un résultat de recherche est ajouté comme par le clic droit sur la carte.
- **Affichages de la journée** (`lib/layout.ts`), au choix sur « Mon compte » (`LayoutPicker`) ou par le sélecteur rapide de la page voyage (`LayoutSwitch`), mémorisé par appareil (`localStorage`, `mytrips.layout`) ; les trois sont maintenus et ont la même édition (ajout, modification, suppression, trajets, dossiers, idées, glisser-déposer) :
  - **Liste et carte** (`list`, par défaut) : timeline verticale à gauche, carte à droite (panneau redimensionnable) ;
  - **Ligne de métro** (`metro`, `MetroLine`, `MetroStop`) : carte en haut, journée en ligne horizontale dessous (stations avec heure de début en avant ; trajets compacts `MetroLeg` posés sur la ligne comme des stations, durée au-dessus, mode et distance dessous, clic pour modifier, « + » qui se déplie pour choisir le mode ; dossiers encadrés, zones de dépôt verticales de largeur fixe ; menu contextuel au clic droit sur une station ou l'en-tête d'un dossier), idées à droite ;
  - **Plein écran** (`board`) : bascule Carte / Timeline ; la timeline montre tous les jours en colonnes (composant `Timeline` de la liste, dépôt avec le jour de la colonne ; plus de boutons d'ajout dans les colonnes : on ajoute un lieu en mode Carte, par le bouton « Lieu », en choisissant son jour), idées en dernière colonne.
  - Socle commun : `lib/trips/dayViews.ts` (`buildDayViews` : éléments, paires de trajets, horaires et numéros de chaque jour), mêmes fenêtres d'édition et mêmes actions de la page voyage.
- **Carte** : étapes numérotées du jour (ou « J2 » en vue d'ensemble), séjours « H », et **idées** qui ont un lieu, marquées de l'icône de leur catégorie (marqueur clair à contour pointillé, icône Lucide du type rendue en SVG par `stepIconSvg`, attribut `data-icon`, nom accessible « Idée · … », sans numéro ni trajet : les tracés ne relient que des étapes placées). Le cadrage suit les étapes placées ; les idées ne servent qu'à défaut.
- **Clic sur un lieu, un trajet ou un lieu découvert** (comme la maquette de référence : `focusPoi`, `focusRoute`, popups `buildPoiPopup`, `buildRoutePopup`, `buildDiscoverPopup`) : la colonne ne sert plus à ouvrir l'édition ; elle sélectionne et cadre l'élément sur la carte, puis ouvre sa popup (`MapPopup`, montée dans une `maplibregl.Popup` de classe `map-popup` ; contenus dans `lib/map/popups.ts`). Une action de la popup la ferme d'abord.
  - **Étape ou idée** (affichage « Liste », colonne des idées) : `flyTo`, zoom 15 au moins. Popup présentée comme celle du clic droit sur la carte : « TYPE · J1 » (ou « Idée ») dans la couleur du type, pastille d'icône du type à gauche du nom, adresse, notes, « Modifier » (éditeur) et « Supprimer » (confirmation). Sans lieu sur la carte (dossier, étape sans point), en « Ligne de métro » (stations) et en « Plein écran », l'éditeur s'ouvre comme avant.
  - **Trajet** (tuile de la timeline « Liste ») : `fitBounds` du tracé (marge 60 px, zoom 16 au plus), popup au milieu du tracé : « MODE · J1 », « départ → arrivée », « distance · durée », pastille « estimé » ou « forcé », lignes de transport en notes, « Modifier » (éditeur du trajet) et « Supprimer » (sans confirmation, comme dans l'éditeur). La tuile reste cliquable en lecture seule (popup sans boutons). Sans tracé affiché, en « Plein écran » : éditeur (pour qui peut modifier) ; la ligne de métro garde l'éditeur.
  - **Lieu découvert** (liste « Explorer ») : `flyTo`, zoom 15 au moins ; popup : type en capitales dans sa couleur (« MUSÉE »), nom précédé de l'icône du type (pastille ronde de 22 px dans la couleur du type, icône de `STEP_ICONS`), adresse, puis la source en petit gris (« OpenStreetMap » ou « Geoapify · OpenStreetMap ») ; pas encore dans le voyage : « Ajouter à J2 » (jour affiché, bouton principal) et « Ajouter aux idées » ; déjà ajouté (même `osmRef`) : pastille cochée « Déjà ajouté » et « Supprimer » (supprime l'étape, avec confirmation). Fermer la popup désélectionne le lieu (plus de second clic pour désélectionner).
  - **Lieu dessiné par le fond « Plan OSM France »** (`lib/map/basemapPois.ts`) : ses tuiles sont des images, sans données. Au zoom 15 au moins, un clic sur la carte (hors marqueur, tracé de trajet ou lieu découvert) cherche les lieux de la découverte (toutes ses catégories, route `/api/poi` et son cache par case du zoom 13) dans un carré de ± 18 px autour du clic et ouvre la popup « Lieu découvert » du plus proche (même contenu, mêmes boutons d'ajout), sans passer par « Explorer ». Chaque case n'est demandée qu'une fois par page (requête en cours partagée, erreur non gardée). Rien hors ligne, sur un autre fond, trop loin d'un lieu, ni pour un lieu hors des catégories de la découverte ; une recherche dépassée par un autre clic, un déplacement de la carte ou un changement de fond est ignorée.
  - **Clic droit sur la carte** (en écriture, hors marqueur) : géocodage inverse du point (`/api/geocode/reverse`, Photon, lieu le plus proche) puis même popup qu'un lieu découvert, ancrée au point cliqué : type, icône et nom, adresse, source « OpenStreetMap », « Ajouter à J2 » / « Ajouter aux idées », ou « Déjà ajouté » et « Supprimer » (même `osmRef`). Rien trouvé ou Photon injoignable : « Point sur la carte », catégorie « Autre ». L'étape créée garde le point cliqué (pas la position du lieu de Photon). Une réponse dépassée par un autre clic ou un déplacement est ignorée. Remplace l'ancien menu « Ajouter ici », qui ajoutait directement le lieu le plus proche, même éloigné.
  - **Sur la carte** : un clic sur un marqueur d'étape ou d'idée, sur un tracé de trajet (couches `legs`, `legs-dashed` ; pas les tracés GPX) ou sur un lieu découvert ouvre la même popup, sans recadrer. La sélection est gardée tant que la popup est ouverte ; une popup qui en remplace une autre ne l'efface pas. Les e2e lisent le zoom par `window.__mapZoomForTests()`.
- **Survol, clic gauche, clic droit : mêmes règles pour tous les lieux** (jours, dossiers, idées ; issue #46). Le survol d'un lieu ou d'un séjour dans la liste (jours, dossiers, idées, ligne de métro) n'a **aucun effet** (25/11/2026) ; seul le survol d'un marqueur met le lieu en évidence dans la liste (liseré) et sur la carte (`scale`) ; le clic gauche cadre et ouvre la popup (ci-dessus) ; le **clic droit** (ou la touche Menu, ou Maj+F10 sur la carte) ouvre un **menu contextuel** (`ContextMenu`, `role="menu"`, au style du menu des fonds de la maquette de référence, une icône par élément ; entrées construites par `stepMenuEntries`, `lib/steps/contextMenu.ts`) :
  - « Modifier » (éditeur), « Supprimer » (confirmation, en rouge) ;
  - « Déplacer vers ▸ » : sous-menu défilant (Idées, J1 · date, J2…, sans l'endroit où se trouve l'élément, son jour même s'il est rangé dans un dossier) ; l'élément va à la fin des racines du jour visé ou des idées, hors de tout dossier (`moveToEndOp`), par un lot annulable (Ctrl+Z) ; un dossier emporte ses étapes ;
  - « Voir dans Google Maps » : lien `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` dans un nouvel onglet (`noopener`), pas pour un dossier ;
  - lecture seule : Google Maps seul (rien pour un dossier, donc pas de menu) ;
  - partout : cartes de la liste et du plein écran, étapes d'un dossier, en-tête d'un dossier, idées, stations et dossiers de la ligne de métro, et **marqueurs** d'étape ou d'idée sur la carte (le clic droit ne remonte pas à la carte : pas de popup Photon ; rien sur un séjour) ;
  - clavier : flèches, Début, Fin, flèche droite (ouvre le sous-menu), flèche gauche et Échap (le referment), Échap (ferme et rend le focus), Tab ; un clic hors du menu ou un redimensionnement le ferme. Position au pointeur bornée à la fenêtre, divisée par la taille d'affichage (`--zoom`).
  - Plus d'actions au survol des cartes (monter, descendre, supprimer ; plus tôt, plus tard en ligne de métro) : on réordonne au glisser-déposer.
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
- invite d'installation (`beforeinstallprompt`, composant `InstallPrompt`) : bouton icône de l'en-tête, affiché quand le navigateur la propose ;
- manifeste `manifest.webmanifest` lié dans `app.html`.

**Hors ligne** (lot 7) :

- **Données** : copie IndexedDB (`idb-keyval`, `lib/offline/store.ts`) de la liste des voyages et de chaque instantané ouvert, avec sa date, mise à jour à chaque chargement et à chaque modification réussie ; un voyage ouvert après la liste y est ajouté. Hors ligne (ou sur échec réseau), la page se charge depuis cette copie (`loadWithFallback`) ; une erreur de l'API (404, 403) n'est jamais masquée par la copie. Le moteur d'horaires recalcule tout localement.
- **Connexion** (`lib/offline/connection.svelte.ts`) : `navigator.onLine`, événements `online`/`offline`, échec réseau d'un appel. Hors ligne : bandeau « Hors ligne · consultation seule · données du JJ/MM à HH:mm » et lecture seule (même mécanisme que le rôle `viewer`, découverte de lieux masquée). Au retour du réseau, les données sont rechargées.
- **Service worker** (stratégies runtime de Workbox, `vite.config.ts`) : style, sprites, polices et TileJSON d'OpenFreeMap en `StaleWhileRevalidate` ; tuiles OpenFreeMap en `CacheFirst` (`ofm-tiles`, 20 000 au plus, 60 jours) ; tuiles OpenTopoMap en `CacheFirst` (5 000 au plus) ; imagerie satellite Esri en `CacheFirst` (`satellite-tiles`, 5 000 au plus, 60 jours) ; vignettes des résumés Wikipédia (`upload.wikimedia.org`, `thumb.wikimedia.org`) en `CacheFirst` (500 au plus). Les réponses de `/api` ne sont **pas** mises en cache par le service worker.
- **« Préparer hors ligne »** (outils de la carte) : emprise de chaque jour (`core.tripBboxes` : étapes, sorties, tracés GPX et de trajets, séjours, marge de 10 %) ; tuiles des zooms 6 à 14 sans doublon (`core.planOfflineTiles`), plafond de 4 000 tuiles (zoom maximal abaissé au-delà) ; estimation à 25 Ko par tuile ; préchargement à la demande seulement, 4 requêtes en parallèle au plus, avec barre de progression ; polices (plages 0–1023) et sprites du style aussi. `navigator.storage.persist()` est demandé ; l'espace utilisé est affiché, « Libérer » retire du cache les tuiles propres au voyage. Le statut « Disponible hors ligne » s'affiche dans la fenêtre « Préparer hors ligne ».

**Design** : direction « Pastel ludique » par défaut, alignée sur la maquette de l'étude initiale (artifact « MyTrips — étude », direction C), et thème « Carnet clair » (direction A).

- Tokens communs dans `apps/web/src/lib/styles/tokens.css` : polices, rayons (8 / 12 / 18 / 22 px), espacements.
- **Pas de page d'accueil** (`routes/+page.svelte`, `lib/home.ts`) : « / » ouvre le voyage donné par `pickStartTrip` (dernier voyage consulté sur l'appareil, `localStorage` `mytrips.lastTrip`, s'il est encore dans la liste ; sinon le voyage en cours ou le prochain départ ; sinon le souvenir le plus récent). Sans voyage : « Aucun voyage pour l'instant » et « Créer un voyage ». Un voyage introuvable (404) ou supprimé est retiré de la liste et oublié comme dernier voyage.
  - **Liste des voyages** (`lib/trips/tripList.svelte.ts`) : chargée par le layout dès que la session est connue (copie hors ligne sans réseau, rechargée au retour du réseau), tenue à jour par la page voyage (`upsertTrip` à chaque nouvel état), par la création et la suppression ; vidée à la déconnexion. La copie hors ligne est calculée depuis le voyage complet (`summaryFromSnapshot`) et une copie plus ancienne est complétée au chargement (`normalizeTripSummary`).
  - **Illustration du voyage** : section « Illustration du voyage » de « Modifier le voyage » : aperçu de la scène (choisie, ou « Automatique : … » pour la suggestion), puis « Changer l’illustration » ouvre la grille (`IllustrationPicker`).
- **Thèmes** : un fichier CSS par thème dans `lib/styles/themes/`, qui définit couleurs et variables de forme sous `[data-theme='…']` (sélecteur valable sur `<html>` comme sur un élément, pour les aperçus). Aucune couleur en dur dans les composants.
  - `pastel.css` : Pastel ludique, sans attribut (clair ou sombre selon le système), `pastel-light` ou `pastel-dark` ; neutres vert d'eau (`--bg` #f6f8f8, `--line` #dde6e7, `--fg` #14282b), accent sarcelle, couleurs par type d'étape, texte sur aplat (`--on-type`, `--on-warn`, `--on-bad`), ombres, voile des fenêtres (`--scrim`).
  - `carnet.css` : Carnet clair (`carnet`), cartes blanches à filet fin, icônes teintées, trajets en bandes grises, rayons plus petits. Clair uniquement.
  - Variables de forme lues par les composants : `--card-tint`, `--card-edge`, `--card-lift`, `--card-radius`, `--icon-tint`, `--icon-ink`, `--icon-radius`, `--leg-tint`, `--leg-base`, `--leg-radius`, `--leg-icon-tint`, `--leg-icon-ink`, `--tab-radius`, `--btn-radius`, `--group-edge-style`, `--group-edge`, `--group-radius`. Ce sont des **pourcentages ou des valeurs simples**, jamais des expressions contenant `var(--c)` : une variable définie sur `<html>` y serait calculée sans la couleur de la carte. Les composants font le mélange (`color-mix(in srgb, var(--c) var(--card-tint), var(--surface))`).
  - Choix sur « Mon compte » (`ThemePicker`) ou dans le menu du profil de l'en-tête (`ProfileMenu`), tenus d'accord par l'événement `mytrips:theme` (`THEME_EVENT`) : Automatique, Pastel ludique clair, Pastel ludique sombre, Carnet clair ; mémorisé par appareil (`localStorage`, clé `mytrips.theme`, `lib/theme.ts`). Un script en ligne de `app.html` pose `data-theme` avant le premier affichage (liste et clé vérifiées par `theme.test.ts`).
- **En-tête de l'application** (`AppHeader`), inspiré de la maquette de référence (projet « Escale ») : une seule ligne de 56 px, dans l'ordre :
  - logo et nom « MyTrips » (lien « MyTrips, accueil » vers « / ») ;
  - **choix du voyage** (`TripSwitcher`, pilule à filet) : liste déroulante personnalisée « Choisir un voyage » (motif WAI-ARIA « combobox à liste seule » : bouton `role="combobox"`, liste `role="listbox"` « Voyages », focus gardé sur le bouton, option active par `aria-activedescendant` ; flèches, Début, Fin, Entrée, Espace, Échap, Tab et clic extérieur). Le bouton montre la vignette et le nom du voyage ouvert (« Choisir un voyage… » hors d'un voyage) ; la liste, sous le bouton, range les voyages en groupes « En cours et à venir » et « Souvenirs », chacun avec sa vignette (44 px), son nom et ses dates, le voyage ouvert coché. Vignette : pictogramme de l'illustration choisie, sinon de celle suggérée par le nom et les lieux (`suggestIllustration`), sinon l'initiale du voyage sur une couleur des trajets du thème (`--leg-1` à `--leg-8`, stable par voyage) ; roue crantée « Paramètres du voyage » (fenêtre « Modifier le voyage », pour qui peut le modifier, posée par la page via `pageHeader.settings`), « + » « Nouveau voyage » (en ligne seulement ; la fenêtre de création est ouverte par le layout, `tripList.creating`) ;
  - contenu de la page (`pageHeader.content`, `lib/page-header.svelte.ts`) : la page voyage y met les **onglets des jours** (« Tout le voyage » avec la période dessous, puis J1, J2… ; quand les jours ne tiennent pas, défilement horizontal sans barre visible, flèches « Jours précédents » avant J1 et « Jours suivants » après le dernier jour, désactivées en bout de liste ; molette verticale et étape glissée sur une flèche font aussi défiler), « Lecture seule » pour un lecteur, puis le sélecteur d'affichage, annuler, rétablir et « Partager » (icône, propriétaire) ;
  - installation de la PWA (icône, si proposée), bouton de profil (icône, nom « Menu du compte (<e-mail>) »).
  - Le nom du voyage est un `<h1>` réservé aux lecteurs d'écran (la liste déroulante l'affiche). E2E : ouvrir la liste (`getByRole('combobox', { name: 'Choisir un voyage' })`) puis cliquer l'option (`getByRole('listbox', { name: 'Voyages' }).getByRole('option', { name, exact: true })`) ; les options n'existent que liste ouverte. Tablette (≤ 1024 px) : les jours passent sur une seconde ligne, sur toute la largeur (les actions restent sur la ligne du profil) ; ≤ 640 px, le nom de l'appli s'efface.
- **Paramètres du voyage** (roue crantée) : nom, dates, illustration, et « Supprimer le voyage » en bas à gauche pour le propriétaire (confirmation, puis « / »).
- **Fenêtres** (`Modal`), façon maquette de référence : fond `--scrim` flouté (`backdrop-filter: blur(3px)`), panneau arrondi (18 px) à ombre `--shadow-modal`, en-tête avec titre (18 px, gras 800), **sous-titre** facultatif (12,5 px, `aria-describedby`) et croix « Fermer la fenêtre », contenu, actions alignées à droite. Le focus va au champ marqué `data-autofocus`, sinon au premier champ du contenu (ou aux actions), jamais à la croix. `hidden` masque la fenêtre sans la fermer (choix sur la carte) ; Échap ne la ferme ni masquée, ni s'il a déjà été traité (`defaultPrevented`).
- **Fenêtres de lieu et de trajet** (comme `openPoiModal`, `openLayerModal` et le panneau d'itinéraire de la maquette) : libellés courts en gras (`.field.ref`, champs à coins de 10 px), deux champs par ligne (`.field-row`), pied « Supprimer » (`btn-danger-ghost`) · « Annuler » · bouton principal. Choix exclusifs en vrais boutons radio masqués dans leur libellé (clavier et lecteurs d'écran natifs), styles partagés dans `controls.css` :
  - `.seg` : **mode de transport** du trajet, un bouton icône et libellé par mode (7) ;
  - `.cat-grid` : **catégorie** du lieu, grille de 4 colonnes (icône de la couleur du type et libellé ; les 17 types dans « Modifier l'étape », plus « Séjour » dans « Nouveau lieu ») ;
  - `.swatches` : **couleur** du trajet, pastilles rondes de 30 px (« Automatique », à filet pointillé, puis les 8 couleurs nommées Sarcelle, Bleu, Violet, Rose, Orange, Vert, Cyan, Ardoise).
  - Lieu : « Nom du lieu », catégorie, **Latitude / Longitude** (6 décimales, validées : -90 à 90, -180 à 180, modifiées ensemble) et « Choisir sur la carte » (absent quand la carte n'est pas affichée) : la fenêtre se masque, un bandeau « Cliquez sur la carte pour placer « nom » · Annuler » s'affiche, curseur en croix (les marqueurs laissent passer le clic) ; le clic remplit les champs, Échap ou « Annuler » abandonne ; rien n'est enregistré avant « Enregistrer ». Lieu déplacé : l'adresse devient celle du lieu le plus proche (`/api/geocode/reverse`, sinon aucune) ; l'API recalcule le fuseau et retire les trajets calculés.
- **Boutons** (`controls.css`) : Manrope gras 13 px, 36 px de haut, coins de 10 px (`--btn-radius`, aussi en Pastel ludique) ; `btn-ghost` blanc à filet, `btn-danger-ghost` (texte rouge) pour une suppression secondaire, `icon-btn` carré de 36 px.
- **Menu du profil** (`ProfileMenu`, `role="menu"`) : e-mail, thèmes (`menuitemradio`), **taille d'affichage** 80 / 90 / 100 % en segments (`menuitemradio`, comme appMyBank ; le menu reste ouvert pour comparer ; `lib/scale.svelte.ts`, clé `mytrips.scale`, 100 % par défaut, appliquée avant le premier affichage par `app.html` ; `global.css` pose `zoom: var(--zoom)` sur `<html>` et divise sa hauteur par le zoom), « Paramètres » (`/compte`), « Administration » (admin), « Se déconnecter » (`lib/auth/signout.ts`, partagé avec `/compte`). Clavier : flèches, Début, Fin, Échap (rend le focus au bouton) ; un clic hors du menu le ferme.
- Polices Manrope (titres et texte, comme la maquette de référence ; corps de 14 px) et JetBrains Mono (horaires, distances), auto-hébergées via `@fontsource-variable` pour fonctionner hors ligne.
- Page voyage, panneau gauche (fond `--surface`) : en-tête du jour séparé par un filet (date, « 08:00 → 22:00 · 14 h », barre sur place / trajets / libre / dépassement en sarcelle / orange / vert / rouge avec légende chiffrée, bandeau orange à bouton plein « Réorganiser ») ; puis la timeline.
- Timeline d'un jour, **compacte** : chaque carte d'étape tient sur une ligne (icône de 28 px et numéro, nom, « type · durée sur place » qui se raccourcit avant le nom, pastilles, horaire « début → fin » à droite, début en gras et en rouge en cas de conflit ; texte lu « début → fin », visuel `aria-hidden`) ; heure du dossier dans son en-tête ; aucune action au survol (menu contextuel au clic droit). Ligne pointillée verticale au milieu des cartes, visible entre les étapes. **Trajet existant** : une ligne fine de 22 px centrée sur le pointillé (icône du mode, durée · distance, origine des valeurs, lignes de transport ; le nom du mode reste lu). **Sans trajet** (facultatif) : un interstice de 10 px ; « + trajet » et les modes apparaissent au survol de cet interstice (ou au clavier), en surimpression, sans décaler la liste ; affichés en permanence s'il y a un trajet à reprendre ; rien en lecture seule (et, en ligne de métro, plus de « ? »). Espacements resserrés : zones de dépôt de 8 px, blocs de la colonne espacés de 8 px, temps libre en pastille fine, boutons d'ajout plus bas. La colonne des idées est plus compacte (variante `dense` de `StepCard`, `GroupCard` et `DropZone` : icône de 22 px, marges réduites, zones de dépôt de 4 px de hauteur fixe) ; plus de bouton « Ajouter une idée ». Le temps libre avant une étape (5 min ou plus) est une pastille verte à contour pointillé avec un sablier (« 1 h 55 de temps libre »). Trajet centré en hauteur entre deux étapes (`--leg-offset` en édition, pour compenser la zone de dépôt). Un dossier se comporte comme une étape : le trajet de sa dernière étape vers la suite s'affiche après le dossier, pas dedans. Ajout : bouton « Lieu » de la carte ; le dossier : bouton icône de l'en-tête du jour.
- Carte : une pilule d'outils en haut à gauche (« Lieu » pour un éditeur, « Explorer la zone » et « Rechercher » en ligne, Préparer hors ligne ; plus de champ de recherche flottant depuis le 25/11/2026). En « Plein écran », le panneau gauche recouvre le bord de la carte : la pilule se décale de sa largeur (variable `--map-tools-inset`). En bas à droite, au-dessus du zoom, un bouton « Fond de carte » (`BasemapPicker`, comme la maquette de référence) ouvre au-dessus de lui la liste des fonds (`role="menu"`, Plan, Plan OSM France, Topo, Satellite en `menuitemradio`, fond courant coché ; flèches, Échap, clic extérieur).

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
  - en-tête : choix du voyage, puis bouton de profil qui ouvre un menu (thème, « Paramètres » vers `/compte`, « Administration » pour un admin, « Se déconnecter ») ;
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

| Migration                    | Contenu                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `0001_init.sql`              | Table technique `meta (key TEXT PK, value TEXT)`                                                  |
| `0002_trips.sql`             | `trips`, `trip_members`, `days`                                                                   |
| `0003_steps.sql`             | `steps` (étapes et dossiers), `stays` (séjours)                                                   |
| `0004_poi_cache.sql`         | `poi_cache` (cache de la découverte de lieux)                                                     |
| `0005_legs.sql`              | `legs` (trajets), `route_cache` (itinéraires)                                                     |
| `0006_gpx.sql`               | colonnes GPX des étapes (randonnées)                                                              |
| `0007_auth.sql`              | `users`, `sessions`, `invitations`, `password_resets`, `auth_attempts`, `ip_bans`, `captcha_used` |
| `0008_trip_cover.sql`        | `trips.cover`, `cover_cache` (photos de couverture)                                               |
| `0009_leg_color.sql`         | `legs.color` (couleur choisie d'un trajet)                                                        |
| `0010_group_style.sql`       | `steps.icon`, `steps.color` (icône et couleur d'un dossier)                                       |
| `0011_trip_illustration.sql` | `trips.illustration` ; retrait de `trips.cover` et de `cover_cache` (photos Commons)              |

- **`trips`** : `id` (UUID), `owner_email`, `name`, `start_date`, `end_date` (AAAA-MM-JJ), `day_start` et `day_end` (HH:mm, défauts 08:00 et 22:00), `default_timezone` (IANA), `hike_speed_kmh` (3.5), `illustration` (identifiant d'illustration ou NULL : suggérée à l'affichage), `version` (verrou optimiste), `created_at`, `updated_at`.
- **`trip_members`** : (`trip_id`, `email`) clé primaire, `role` (`viewer` | `editor`), `created_at`.
- **`days`** : `id`, `trip_id`, `date` (unique par voyage), `day_start` et `day_end` (NULL = heures du voyage), `notes`.
- **`steps`** : étapes et dossiers.
  - Placement : `id`, `trip_id`, `day_id` (NULL = liste d'idées), `parent_id` (dossier), `position` (clé d'ordre fractionnaire parmi les frères), `kind` (`step` | `group`).
  - Contenu : `type` (17 types dont `parking`, NULL pour un dossier), `name`, `lat`/`lng` (NULL pour un dossier), `address`, `exit_lat`/`exit_lng` (point de sortie, NULL = entrée), `duration_min`, `fixed_start` (HH:mm), `timezone` (IANA, déduit du point), `opening_hours`, `osm_ref`, `booking_ref`, `booking_url`, `notes` ; dossier seulement : `icon` (type d'étape dont l'icône est reprise, NULL : icône dossier) et `color` (rang 0 à 7 de la palette des trajets, NULL : accent).
- **`poi_cache`** : `key` (`<catégorie>:13:<x>:<y>`, case de carte au zoom 13), `payload` (lieux normalisés, JSON), `source` (`overpass` | `geoapify`), `created_at`. Valable 7 jours.
- **`stays`** : séjours. `id`, `trip_id`, `name`, `lat`, `lng`, `address`, `check_in_date`/`check_in_time` (défaut 17:00), `check_out_date`/`check_out_time` (défaut 10:00), `booking_ref`, `notes`.

**Règles** :

- Les jours suivent la période du voyage : à la création, et à chaque changement de dates, les jours manquants sont créés et les jours hors période supprimés. Les jours conservés gardent leur identifiant et leurs notes.
- Un jour est **non vide** s'il a des notes ou des étapes. Supprimer des jours non vides demande `?force=true`, sinon la réponse est `409 days_not_empty` ; avec `force`, leurs étapes (dossiers compris) passent dans la liste d'idées et leurs notes sont perdues.
- **Ordre** : clés fractionnaires (`fractional-indexing`) comparées comme des chaînes ; un déplacement ne réécrit que l'élément déplacé. Égalité départagée par l'identifiant.
- **Dossiers** : un seul niveau. Un dossier est à la racine d'un jour (ou des idées) ; ses étapes sont du même jour. Déplacer un dossier de jour emporte ses étapes ; changer une étape de jour sans préciser de dossier la sort de son dossier. Supprimer un dossier non vide exige `?children=keep` (ses étapes reprennent sa place, dans l'ordre) ou `?children=delete`. `icon` et `color` sont réservés aux dossiers : `StepCreate` les refuse sur une étape, `PATCH` répond `400 invalid` (`null` remet la valeur par défaut).
- **Séjours** : non stockés jour par jour. Un séjour couvre les nuits de `check_in_date` à `check_out_date` (exclu). Le matin d'un jour dont la nuit précédente est couverte, il apparaît en « départ » (ou « check-out » le dernier jour) ; le soir d'un jour dont la nuit suivante est couverte, en « retour » (ou « check-in » le premier jour). Clé d'occurrence : `stay:<id>:<date>:start|end`.
- **Timeline d'un jour** (`core.dayTimeline`) : séjour du matin, racines triées (dossiers avec leurs étapes triées), séjour du soir. `core.dayRoute` l'aplatit en points d'entrée/sortie pour la carte et les trajets (lot 4).
- Durée maximale d'un voyage : 90 jours. Une journée doit finir après son début : la règle est vérifiée avec les valeurs existantes quand un seul des deux champs change.
- **Verrou optimiste** : toute modification du voyage ou d'un jour exige `If-Match: <version>` (428 sinon) et incrémente `trips.version`, dans la même transaction D1 que la modification. Une version périmée donne `409 { error: 'version_conflict', version }`. Les changements de membres ne changent pas la version.

- **`legs`** : trajets. `id`, `trip_id`, `from_key` et `to_key` (clé d'étape ou d'occurrence de séjour ; unique par voyage), `mode` (`car`, `bike`, `walk`, `bus`, `train`, `plane`, `ferry`), `distance_m` (NULL si inconnue), `duration_min`, `distance_source` et `duration_source` (`router`, `estimate` ou `manual`), `geometry` (polyligne encodée, précision 5), `summary` (lignes empruntées), `depart_at` (HH:mm fixé), `booking_ref`, `color` (rang 0 à 7 dans la palette des trajets, NULL : automatique), `notes`, `computed_at`.
- **Randonnées GPX** (colonnes de `steps`, `0006`) : `gpx_stats` (JSON : `distanceM`, `ascentM`, `descentM`, `minEle`, `maxEle`, `isLoop`, `pointCount`), `gpx_track` (JSON : `[[lat, lng, ele|null], …]`, 500 points au plus), `use_elevation`, `duration_manual`.
- **`route_cache`** : `key` (mode, `v2` (tracés complets ; les entrées antérieures, allégées à 600 points, sont ignorées), points arrondis à 5 décimales, tranche horaire pour bus et train), `payload` (`RouteResult`), `created_at`. Valable 30 jours, 6 h pour bus et train. Seuls les calculs des fournisseurs sont mis en cache (pas les estimations, ni l'avion et le ferry, calculés localement).

**Trajets** :

- Un trajet est **possible** (facultatif) entre deux points consécutifs d'un jour (`core.requiredLegs`, nom historique, sur `dayRoute` : dossiers aplatis, séjours compris). Il part du point de sortie de l'étape précédente et arrive au point d'entrée de la suivante. Sans trajet, « + trajet » apparaît au survol de l'espace entre les deux lieux.
- **Trajet caduc** : après toute écriture sur les étapes, les séjours ou la période, les trajets dont la paire n'est plus consécutive sont supprimés (`pruneStaleLegs`), juste après l'écriture et conditionnés à la version. Le front propose de **reprendre** un trajet saisi à la main ainsi retiré (« Reprendre : Voiture 45 min ») sur une tuile vide qui touche l'une de ses étapes.
- **Lieu déplacé** : changer le point d'une étape ou d'un séjour retire, dans la même transaction, ses trajets calculés ; ceux qui contiennent une saisie manuelle sont gardés.
- **Saisie manuelle** : une durée saisie est gardée ; une distance saisie seule donne une durée à la vitesse moyenne du mode (voiture 60 km/h, vélo 15, marche 4,5, bus 30, train 80, avion 750, ferry 30) ; « Recalculer » revient au routeur. Sans itinéraire, la durée saisie suffit (distance inconnue).
- **Couleur** (comme les couches de la maquette, `LAYER_COLORS`) : palette de 8 couleurs, variables `--leg-1` à `--leg-8` de chaque thème (`core.legColorVar`). Automatique (NULL) : chaque trajet du jour prend la couleur qui suit celle du trajet précédent, la première pour le premier (`core.dayLegColors`) ; une couleur choisie dans « Modifier le trajet » est gardée. Tracé, ligne de la timeline, rond de la ligne de métro et popup prennent cette couleur (`DayPair.color`) ; le mode ne donne plus que l'icône et les pointillés de la marche. `POST` accepte `color`, `PATCH` `color` (null : automatique) sans nouveau calcul.
- **Départ des bus et trains** : heure fixée du trajet, sinon fin de l'étape de départ selon les horaires calculés du jour (moteur ci-dessous), dans le fuseau de cette étape.

**Randonnées GPX** (`core/gpx`) :

- **Analyse dans le navigateur** (`prepareGpx`, `fast-xml-parser`) : le Worker gratuit n'a que 10 ms de CPU par requête (un GPX de 4,8 Mo et 50 000 points prend environ 1,7 s). L'API reçoit `{ stats, track }` (`GpxData`, validé par Zod) ; le fichier original n'est pas conservé.
- **Lecture** : `trk/trkseg/trkpt` (segments concaténés dans l'ordre), sinon `rte/rtept` ; nom de la trace, sinon des métadonnées, sinon du fichier ; 10 Mo au plus, XML valide, au moins 2 points.
- **Statistiques** : distance en haversine cumulée ; D+ et D− sur des altitudes lissées (moyenne glissante sur 5 points) avec un seuil de 3 m ; sans altitude sur au moins la moitié des points, dénivelé inconnu ; boucle si départ et arrivée à moins de 200 m.
- **Tracé simplifié** : Ramer–Douglas–Peucker jusqu'à 500 points au plus, départ et arrivée conservés.
- **Points** : le premier point du tracé devient l'entrée de l'étape (`lat`/`lng`), le dernier sa sortie (`exit_lat`/`exit_lng`) ; le trajet suivant part de la sortie.
- **Durée** : distance ÷ `hike_speed_kmh` (3,5 km/h par défaut), plus 1 h par 600 m de D+ si l'option est cochée, arrondie aux 5 min. Une durée saisie devient manuelle (`duration_manual`) ; changer l'option dénivelé recalcule et repasse en automatique.
- **Import** : à la création, catégorie « Randonnée » de la fenêtre « Nouveau lieu » (bouton « Importer un GPX »), ou fichier glissé sur la timeline du jour ; dans l'éditeur d'une randonnée : importer, remplacer ou retirer le GPX. Remplacer ou retirer le tracé déplace les points : les trajets calculés adjacents sont retirés.
- **Affichage** : pastilles « GPX 12,4 km » et « D+ 620 m », profil altimétrique (SVG) dans l'éditeur, tracé vert sur la carte, marqueur d'arrivée « ⚑ » quand ce n'est pas une boucle.

**Horaires** (`core.scheduleDay`, en minutes et en heure locale avec Luxon, fuseau toujours explicite) :

- Départ au début du jour (`day_start` du jour, sinon du voyage : `resolveDayBounds`), puis on enchaîne arrivée, fin de l'étape (arrivée + durée), trajet, etc. ; dossiers aplatis, séjours compris (durée 0).
- **Heure fixe = ancre** : arrivée en avance = temps libre ; en retard = **conflit** avec le retard en minutes ; l'étape commence à son heure fixe dans les deux cas. Même règle pour le départ fixé d'un trajet (`depart_at`).
- **Fuseaux** : l'arrivée d'un trajet s'exprime dans le fuseau de l'étape d'arrivée ; « +1 j » au-delà de minuit. Un séjour prend le fuseau de l'étape voisine, sinon celui du voyage ; fuseau inconnu = UTC.
- **Dépassement** : fin de la dernière activité (ou arrivée au séjour du soir) après `day_end`.
- **Sans trajet** (facultatif) : l'enchaînement compte 0 min, sans signalement (ni bandeau, ni pastille d'alerte de l'onglet).
- **Dossier** : du début de son premier enfant à la fin du dernier.
- Résultat : `start`, `end`, `freeBeforeMin`, `issues` par élément et par trajet ; résumé du jour (sur place, trajets, libre, dépassement, conflits, retard total). Calculé côté front à chaque changement (`$derived`), et côté Worker pour le départ des bus et trains.

**Réorganisation** (`core.proposeFixes`) : chaque règle est simulée par le moteur ; seules les propositions qui réduisent « retard + dépassement » sont gardées, triées par gain, 4 au plus.

1. Raccourcir les étapes souples avant la première ancre en conflit, en proportion de leur marge (jamais sous 50 % de leur durée ni sous 15 min).
2. Avancer le début du jour (2 h au plus, par pas de 5 min).
3. Déplacer une étape souple (la plus courte qui suffit, sinon la plus longue) vers le jour qui a le plus de temps disponible, sinon vers les idées.
4. Permuter deux étapes souples adjacentes si les trajets connus du nouvel ordre sont plus courts (pas de proposition sans durées connues).
5. Dépassement : retarder la fin du jour (23:59 au plus), ou reporter la dernière étape souple au lendemain.

Une proposition s'applique par un **lot atomique** (`POST /api/trips/:id/batch`) : modifications d'étapes (`StepPatch`) et de jours (`DayPatch`), toutes validées avant d'écrire, en une seule version ; trajets caducs nettoyés ensuite.

**Annuler / rétablir** (Ctrl+Z, Ctrl+Y ou Ctrl+Maj+Z, boutons de l'en-tête) : pile côté front (`lib/schedule/history.ts`). Chaque commande garde ses opérations de lot et leurs inverses, calculés sur l'état avant application. Périmètre : modifications d'étape, déplacements (glisser-déposer, « Déplacer vers » du menu contextuel, changement de jour), propositions de réorganisation. La pile est vidée après un conflit de version et au changement de voyage. Les raccourcis ne s'appliquent pas dans un champ de saisie ni dans une fenêtre.

## 5. Surface API

| Méthode | Route                                        | Droit        | Réponse                                                                                                               |
| ------- | -------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| GET     | `/api/health`                                | aucun        | `200 { ok: true }`                                                                                                    |
| GET     | `/api/me`                                    | connecté     | `200 { email, isAdmin }`                                                                                              |
| GET     | `/api/auth/captcha`                          | aucun        | `200 { question, token }`                                                                                             |
| POST    | `/api/auth/signup`                           | aucun        | `201 Me` + cookie · `{ email, password, captcha: { token, answer } }`                                                 |
| POST    | `/api/auth/login`                            | aucun        | `200 Me` + cookie · `{ email, password }`                                                                             |
| POST    | `/api/auth/logout`                           | aucun        | `204`, cookie effacé                                                                                                  |
| POST    | `/api/auth/reset/:token`                     | aucun        | `204` · `{ password }` · ferme toutes les sessions                                                                    |
| POST    | `/api/auth/password`                         | connecté     | `204` · `{ current, next }` · ferme les autres sessions                                                               |
| POST    | `/api/trips/:id/invitations`                 | propriétaire | `201 { token, role, expiresAt }` · `{ role }`                                                                         |
| GET     | `/api/invitations/:token`                    | connecté     | `200 { tripId, tripName, ownerEmail, role }`                                                                          |
| POST    | `/api/invitations/:token/accept`             | connecté     | `200 { tripId }`                                                                                                      |
| POST    | `/api/admin/resets`                          | admin        | `201 { token, expiresAt }` · `{ email }`                                                                              |
| GET     | `/api/admin/bans`                            | admin        | `200 { bans: IpBan[] }`                                                                                               |
| DELETE  | `/api/admin/bans/:ip`                        | admin        | `204`                                                                                                                 |
| GET     | `/api/trips`                                 | connecté     | `200 { trips: TripSummary[] }` (rôle, illustration, `stepCount`, `distanceM`, `places`)                               |
| POST    | `/api/trips`                                 | connecté     | `201 TripSnapshot`                                                                                                    |
| GET     | `/api/trips/:id`                             | lecture      | `200 TripSnapshot` (voyage, rôle, jours, membres, étapes, séjours)                                                    |
| PATCH   | `/api/trips/:id[?force=true]`                | modification | `200 TripSnapshot` · `If-Match` obligatoire                                                                           |
| DELETE  | `/api/trips/:id`                             | propriétaire | `204`                                                                                                                 |
| PATCH   | `/api/trips/:id/days/:dayId`                 | modification | `200 TripSnapshot` · `If-Match` obligatoire                                                                           |
| PUT     | `/api/trips/:id/members/:email`              | propriétaire | `204` · corps `{ role }` · membre existant seulement (`404 not_member`)                                               |
| DELETE  | `/api/trips/:id/members/:email`              | propriétaire | `204`                                                                                                                 |
| POST    | `/api/trips/:id/steps`                       | modification | `201 TripSnapshot` · `If-Match` · position absente = fin de liste                                                     |
| PATCH   | `/api/trips/:id/steps/:stepId`               | modification | `200 TripSnapshot` · `If-Match` · champs et déplacement (`dayId`, `parentId`, `position`) ; dossier : `icon`, `color` |
| DELETE  | `/api/trips/:id/steps/:stepId[?children=keep | delete]`     | modification                                                                                                          | `200 TripSnapshot` · `If-Match` |
| POST    | `/api/trips/:id/stays`                       | modification | `201 TripSnapshot` · `If-Match`                                                                                       |
| PATCH   | `/api/trips/:id/stays/:stayId`               | modification | `200 TripSnapshot` · `If-Match`                                                                                       |
| DELETE  | `/api/trips/:id/stays/:stayId`               | modification | `200 TripSnapshot` · `If-Match`                                                                                       |
| GET     | `/api/geocode?q=&lat=&lng=`                  | connecté     | `200 { results: Place[] }` (Photon, biais vers lat/lng)                                                               |
| GET     | `/api/geocode/reverse?lat=&lng=`             | connecté     | `200 { result: Place                                                                                                  | null }`                         |
| GET     | `/api/poi?bbox=O,S,E,N&zoom=&categories=a,b` | connecté     | `200 { pois: Poi[], source }` (zone visible, zoom ≥ 12, 40 cases au plus)                                             |
| GET     | `/api/poi/wiki?ref=`                         | connecté     | `200 { summary }` (`ref` : `Q123` ou `langue:titre` ; `summary` : `WikiSummary` ou null)                              |
| POST    | `/api/trips/:id/legs`                        | modification | `201 TripSnapshot` · `If-Match` · remplace le trajet de la même paire                                                 |
| PATCH   | `/api/trips/:id/legs/:legId`                 | modification | `200 TripSnapshot` · `If-Match` · `null` remet au routeur, `recompute: true`                                          |
| DELETE  | `/api/trips/:id/legs/:legId`                 | modification | `200 TripSnapshot` · `If-Match`                                                                                       |
| POST    | `/api/route`                                 | connecté     | `200 { route: RouteResult }` · corps `{ mode, from, to, departAt? }`                                                  |
| POST    | `/api/trips/:id/batch`                       | modification | `200 TripSnapshot` · `If-Match` · `{ ops: BatchOp[] }` (1 à 50), atomique                                             |
| PUT     | `/api/trips/:id/steps/:stepId/gpx`           | modification | `200 TripSnapshot` · `If-Match` · corps `{ gpx: GpxData }` (randonnée)                                                |
| DELETE  | `/api/trips/:id/steps/:stepId/gpx`           | modification | `200 TripSnapshot` · `If-Match`                                                                                       |

- **Erreurs d'authentification** : `400 invalid_captcha`, `wrong_password`, `already_owner` ; `401 unauthorized` (sans session), `invalid_credentials` ; `403 bad_origin`, `ip_banned` ; `404 invalid_invitation`, `invalid_link`, `unknown_user`, `not_member` ; `409 email_taken` ; `429 too_many_attempts` ; `500 auth_not_configured` (`AUTH_SECRET` absent).
- **Erreurs** : `400 invalid` (avec `issues`), `invalid_json`, `invalid_day`, `invalid_parent`, `children_mode_required`, `invalid_query`, `invalid_coordinates`, `invalid_bbox`, `invalid_zoom`, `invalid_categories`, `zoom_too_low`, `area_too_large`, `invalid_ref`, `invalid_leg` ; `401` ; `403 forbidden` ; `404 not_found` ; `409 version_conflict` ou `days_not_empty` ; `422 no_route` ; `428 version_required` ; `502 geocoder_unavailable` ou `wiki_unavailable` ; `503 poi_unavailable`.
- Toute route `/api/*` passe d'abord par le contrôle d'origine (CSRF) ; toutes, sauf `/health` et les routes publiques de `/auth`, exigent ensuite une session.
- Les schémas (`TripCreate`, `TripPatch`, `DayPatch`, `MemberPut`, `StepCreate`, `StepPatch`, `StayCreate`, `StayPatch`) et les types de réponse (`Step`, `Stay`, `Place`…) sont dans `packages/core`.

## 6. Intégrations externes

- **Carte** : MapLibre GL JS 6, avec quatre fonds au choix.
  - **Plan** : OpenFreeMap, style Liberty (`https://tiles.openfreemap.org/styles/liberty`), sans clé et fourni sans garantie.
  - **Plan OSM France** (`osmfr`, comme la maquette de référence) : tuiles raster d'OpenStreetMap France (`https://{a,b,c}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png`, zoom 20 au plus, libellés en français), sans clé, mentions « OSM France » et « contributeurs OpenStreetMap ». Mises en cache par le service worker à la consultation (`osmfr-tiles`), mais pas préchargées par « Préparer hors ligne » (qui ne précharge que le plan).
  - **Topo** : OpenTopoMap (tuiles raster, zoom 17 au plus).
  - **Satellite** (vue hybride) : imagerie Esri World Imagery (tuiles raster sans clé, zoom 19 au plus, attribution obligatoire) sous les routes, frontières et libellés du style Liberty. `styleFor('satellite')` charge Liberty et `transformFor('satellite')` le transforme (`toHybrid`, après `guardMissingNumbers`) : aplats, bâtiments, relief, tunnels, contours de routes et hachures retirés ; routes à 60 % d'opacité ; libellés en blanc sur halo sombre (sauf panneaux de route). Changement de fond par `setStyle(…, { diff: false, transformStyle })` : plan et satellite partageant sprite et polices, MapLibre appliquerait sinon un diff sans émettre `style.load`, et les tracés et lieux ajoutés par l'appli seraient perdus.
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
- **Illustrations des voyages** (logique pure dans `packages/core/src/illustration`, dessins dans `apps/web/src/lib/illustrations`) :
  - **24 thèmes** dessinés pour le projet (`ILLUSTRATIONS`, dans l'ordre de la grille) : randonnée, plage, montagne, roadtrip en voiture, van, camping-car, camping, vélo, moto, ville, ski, train, avion, croisière, voilier, lac, forêt, désert, île, kayak, campagne, safari, festival, voyage générique ;
  - **deux dessins par thème**, en SVG : une scène 160 × 100 (`scenes/`, grille de choix et aperçu) et un pictogramme 48 × 48 (`pictos/`, vignettes de 26 et 44 px, où une scène serait illisible) ;
  - **couleurs** : uniquement `var(--illu-*)` (ciel, soleil, lointain, sol, arbre, roche, eau, sable, route, vitre, crème, accent, accent 2, encre, clair, peau), définies dans chaque thème (`pastel.css` clair et sombre, `carnet.css`) ; un test (`illustrations.test.ts`) refuse toute couleur en dur, tout `id` (plusieurs exemplaires d'un SVG cohabitent dans la page) et toute variable non définie dans un thème ;
  - **affichage** (`Illustration.svelte`) : SVG du dépôt insérés par `{@html}` (jamais une donnée de l'utilisateur ni de l'API) ; pictogrammes chargés avec la page, scènes dans un module à part importé au premier affichage d'une scène (`loadScenes`) ;
  - **voyage** : `trips.illustration` ne contient que l'identifiant (`IllustrationId`, `enum` Zod) ou NULL ; `PATCH` avec `illustration` (identifiant ou `null`), toute autre valeur répond 400 ; une valeur inconnue en base est lue comme `null` (`parseIllustration`) ;
  - **suggestion** (`suggestIllustration(nom, lieux)`) : sans illustration choisie, elle est déduite à l'affichage, sans rien enregistrer. Mots-clés sans accents ni casse, mots entiers (« Vanoise » n'est pas « van »), dans l'ordre de priorité : le moyen de transport le plus précis d'abord (« camping-car » avant « camping », « road trip en van » donne le van), puis les activités, enfin les paysages ; le nom passe avant les lieux (les 3 premiers, ceux de la liste des voyages), où seuls des paysages sont cherchés, avec des mots-clés plus stricts (`PLACE_KEYWORDS` : une gare, un aéroport ou une ville ne disent rien du genre du voyage, ni « Île de la Cité », « Bois de Boulogne » ou « Mer de Glace »). Sans correspondance : initiale du voyage. Le voyage générique n'est jamais suggéré ;
  - **choix** dans « Modifier le voyage » (`IllustrationPicker`, grille `.cat-grid` de 25 boutons radio : « Automatique » puis les 24 thèmes) ; l'illustration n'est envoyée que si elle a changé ; disponible hors ligne (aucun appel réseau).
- **Lieux découverts sur la carte** (`lib/map/pois.ts`, `TripMap.svelte`) : dessinés par MapLibre (source GeoJSON `pois`, couche `circle` colorée par type d'étape, rayon 11 px, 15 px actif), et non en marqueurs HTML, pour suivre la carte sans décalage. Icône blanche du type au centre (couche `symbol` `poi-icons`, propriété `icon` = `poi-icon-<type>`) : MapLibre ne peut pas dessiner un composant Lucide, l'icône de `STEP_ICONS` est donc rendue en SVG (`lib/map/poiIcons.ts`, 13 px, densité 2) puis ajoutée au style par `addImage`, une fois par fond (le changement de fond efface les images ; l'image vide posée entre-temps par le résolveur d'images manquantes est remplacée). Le lieu survolé ou sélectionné porte l'état `active` (`setFeatureState`, `promoteId: 'id'`) : pastille plus grande et opaque. Choisir un lieu dans la liste ou cliquer sa pastille (marge de 8 px, le plus proche l'emporte) le sélectionne et ouvre sa popup (voir « Clic sur un lieu, un trajet ou un lieu découvert »). Les e2e lisent les lieux dessinés par `window.__mapPoisForTests()` (avec l'icône et si son image est chargée) et cliquent un point par `window.__mapProjectForTests()`.
- **Ajout d'un lieu découvert** : étape pré-remplie (nom, type, point, adresse, horaires d'ouverture, `osm_ref`) ; site, téléphone et cuisine dans les notes. Un lieu dont l'`osm_ref` est déjà dans le voyage est marqué « Déjà ajouté ».

- **Routage** (`apps/api/src/routing/providers.ts`, `POST /api/route` et création des trajets) :
  - **voiture, vélo, marche** : OSRM, serveurs publics de FOSSGIS (`https://routing.openstreetmap.de`, sans clé), un serveur par profil : `routed-car`, `routed-bike`, `routed-foot` (`GET /<serveur>/route/v1/driving/<lng>,<lat>;<lng>,<lat>?overview=full&geometries=polyline` ; le profil `driving` du chemin est ignoré par ces serveurs). Le **tracé complet** est enregistré tel quel (polyligne de précision 5, le format de `legs.geometry`), sans allègement ni décodage, comme la référence : environ 40 Ko pour Paris → Marseille (775 km). Les tracés de Transitous sont gardés entiers eux aussi. En erreur (429, 5xx, autre code OSRM que `Ok`, réseau, délai de 10 s) : **estimation locale** (grand cercle × 1,3 à la vitesse du mode, en ligne droite), marquée « estimé ». Les codes `NoRoute` et `NoSegment` (réponse 400), ou une réponse `Ok` sans itinéraire, signifient qu'aucune route n'existe : `422 no_route`. Politique d'usage FOSSGIS : une requête par seconde au plus, pas d'usage lourd, User-Agent valide, mention et lien « fix the map » ;
  - **bus, train** : Transitous (MOTIS 2, `GET /api/v5/plan`, polylignes en précision 6). Itinéraire le plus court, puis le moins de correspondances ; lignes résumées (`displayName`, ex. « TER 17611 »). Aucun itinéraire : `422 no_route` ; erreur du service : estimation locale ;
  - **avion** : grand cercle, distance ÷ 750 km/h + 30 min, tracé en arc ; **ferry** : grand cercle à 30 km/h ;
  - User-Agent `MyTrips/0.1 (+<CONTACT_URL>)` : la politique de Transitous exige un moyen de contact, un projet open source publié et un usage non commercial ;
  - les URL de base (`OSRM_URL`, `TRANSITOUS_URL`, comme `PHOTON_URL` et `GEOAPIFY_URL`) peuvent contenir un chemin (relais, services factices des e2e) ;
  - mentions « FOSSGIS (OSRM) » (avec le lien « signaler une erreur » vers `openstreetmap.org/fixthemap`) et « Transitous » (lien vers `transitous.org/sources`) dans l'attribution de la carte ;
  - tests d'API : `vitest.config.ts` fixe `OSRM_URL` sur une adresse injoignable, aucun test n'appelle le vrai service.

Secrets : `AUTH_SECRET` (obligatoire : signature des captchas), `GEOAPIFY_API_KEY` (facultatif, secours de la découverte). Variables : `ADMIN_EMAILS` (administrateurs), `CONTACT_URL` (URL du projet publié, pour Transitous).

## 7. Contraintes non fonctionnelles

- **Desktop et tablette uniquement** (largeurs de 768 px et plus, mise au point à 1280 px), thèmes clair et sombre. Pas d'adaptation téléphone à prévoir : une application mobile distincte viendra plus tard (les règles « petit écran » existantes, ≤ 640 px, évitent seulement le débordement).
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
- **Pas de couleur stockée par voyage** (prévue dans le plan) : un champ et un sélecteur sans valeur métier.
- **Plus de page d'accueil, voyages choisis dans l'en-tête** (choix de l'utilisateur, sur le modèle de la maquette « Escale ») : « / » rouvre le dernier voyage consulté ; paramètres par la roue crantée, suppression dans ses paramètres. D'abord une liste déroulante native, remplacée le 24/11/2026 par une liste personnalisée (une liste native ne peut pas montrer d'image) : la photo de couverture y revient en vignette. Le 25/11/2026, les photos Wikimedia Commons (souvent hors sujet) sont remplacées par des illustrations dessinées pour le projet (issue #60) : unDraw écarté (licence qui déconseille de les intégrer à une application et interdit leur redistribution, dépôt public ; ni van, ni camping-car, ni ski), aucun service gratuit d'illustrations avec API et licence propre.
- **Lieux du fond OSM France par la découverte** (24/11/2026) : les tuiles raster ne disent pas ce qui est dessiné ; plutôt qu'une couche vectorielle cachée (autres données que celles du fond, sans adresse ni référence OSM fiable) ou une nouvelle requête Overpass par clic, on réutilise la route et le cache de la découverte : popup et ajout identiques, appels Overpass limités à un par case et par semaine.
- **Un seul point d'entrée pour ajouter un lieu, « Séjour » comme catégorie** (25/11/2026, issue #48, demande de l'utilisateur) : le bouton « Lieu » de la carte, comme la référence, remplace les boutons sous les jours. Le choix du lieu (recherche, carte, coordonnées) précède un formulaire complet, celui de l'éditeur, pour ne pas maintenir deux fenêtres. Un séjour n'étant pas une étape (table `stays`, plusieurs nuits), « Séjour » n'existe qu'à la création : transformer une étape en séjour n'est pas proposé.
- **Clic droit : popup avant l'ajout** (24/11/2026, demande de l'utilisateur) : « Ajouter ici » ajoutait le lieu le plus proche renvoyé par Photon (sans limite de distance), d'où une école ajoutée là où rien n'était dessiné. Le clic droit montre désormais ce lieu dans la popup des lieux découverts, et l'utilisateur choisit. Position de l'étape : le point cliqué (« ici »), car Photon renvoie pour une rue ou une ville un point parfois éloigné.
- **Menu contextuel des lieux plutôt qu'actions au survol** (24/11/2026, issue #46, demande de l'utilisateur) : mêmes gestes partout (survol, clic, clic droit), y compris sur les marqueurs. La maquette de référence n'a pas de menu contextuel : il reprend le style de son menu des fonds (déjà copié par `BasemapPicker`). « Déplacer vers » en sous-menu, le voyage pouvant compter 90 jours. Contrepartie : plus de réordonnancement au clavier (voir §9).
- **« Rechercher » et « Explorer la zone » unifiés** (25/11/2026, demande de l'utilisateur) : même panneau gauche, mêmes groupes et lignes, mêmes gestes (clic gauche : zoom et popup ; clic droit : menu commun), plus aucun bouton sur les lignes (les « + J2 » et « + Idées » de la découverte passent dans le menu, « Ajouter à un jour » proposant tous les jours). Les résultats de recherche n'ont pas de pastilles sur la carte (popup au clic seulement), et la liste de la découverte ne met plus ses pastilles en évidence, pour garder le même comportement (choix de l'utilisateur). Le menu d'un lieu déjà ajouté reprend la règle de sa popup (« Supprimer »).
- **Aucune action au survol des lieux de la liste** (25/11/2026, demande de l'utilisateur) : le survol d'un lieu ou d'un séjour (jours, dossiers, idées, ligne de métro) ne met plus rien en évidence. Le lien reste dans l'autre sens : survoler un marqueur met le lieu en évidence dans la liste. Les trajets gardent leur mise en évidence au survol.
- **Glisser-déposer HTML5 natif** (plutôt que `svelte-dnd-action` prévu dans le plan) : zones de dépôt imbriquées simples (jour, dossier, onglet de jour, idées) et e2e fiables avec Playwright ; complété par le choix du jour dans l'éditeur et « Déplacer vers » du menu contextuel. Les boutons monter / descendre (et plus tôt / plus tard du métro) ont été retirés le 24/11/2026 (issue #46, demande de l'utilisateur).
- **Cache de la découverte au zoom 13** (plutôt que 14 prévu dans le plan) : au zoom 12 minimal, la zone visible couvre une vingtaine de cases du zoom 13, sous le plafond de 40 ; au zoom 14, il en faudrait plus de 60.
- **Overpass factice pour les e2e** (plutôt qu'une interception Playwright prévue dans le plan) : Overpass est appelé par le Worker, comme Photon.
- **Nettoyage des trajets caducs juste après l'écriture** (le plan prévoyait la même transaction) : il faudrait sinon recalculer la timeline de l'état futur avant d'écrire. Conditionné à la version, il ne supprime rien si une autre écriture est passée entre-temps (elle fait alors son propre nettoyage) ; le front n'affiche de toute façon que les trajets des paires requises.
- **Calcul des trajets côté Worker** : le front n'envoie que la paire et le mode ; le Worker retrouve les points, l'heure de départ estimée et le fuseau.
- **Estimation locale quand le routeur est en erreur** (le plan prévoyait un message d'erreur) : choix de l'utilisateur, la tuile affiche « estimé ».
- **OSRM de FOSSGIS plutôt qu'OpenRouteService** (23/11/2026, demande de l'utilisateur) : sans clé ni compte (ORS demandait une clé, définie en production comme secret `ORS_API_KEY`, supprimé le 23/11/2026 après le passage à OSRM).
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
- **Illustrations** : la suggestion ne connaît que des mots-clés français (et quelques villes) ; un nom sans indice laisse l'initiale. Le cache Workbox des anciennes photos Commons reste chez les utilisateurs qui l'avaient (sans danger, il n'est plus lu que pour les vignettes Wikipédia).
- **Migrations en production** : chaque nouvelle migration doit être appliquée (`pnpm --filter @mytrips/api db:migrate:remote`) **avant** de déployer le code qui l'utilise.
- **Trajets** :
  - **Transitous** : conditions de sa politique d'usage remplies le 16/11/2026 : dépôt public sous licence MIT, `CONTACT_URL` (URL du dépôt) dans les `vars` de `wrangler.jsonc`, lien vers ses sources dans l'attribution de la carte ;
  - **OSRM de FOSSGIS** : service gratuit sans garantie de disponibilité, limité à une requête par seconde (le cache `route_cache` de 30 jours limite les appels ; pas de file d'attente côté Worker) ;
  - un dossier replié masque les tuiles de trajet de ses étapes ;
  - la proposition « Reprendre » ne vit que pendant la session (non stockée) ;
  - un trajet recréé sur la même paire (nouveau mode depuis la tuile, reprise) repart en couleur automatique ;
  - les couleurs des tracés sont lues au moment du dessin : un changement de thème ne les met à jour qu'au prochain changement des trajets.
- **Découverte de lieux** :
  - les instances publiques d'Overpass étaient **saturées** lors du contrôle manuel du 16/11/2026 (`overpass-api.de` : « at capacity », `overpass.private.coffee` : plus de 25 s) ; sans clé Geoapify, la découverte répond alors 503. Fournisseurs réels **non vérifiés** de bout en bout ;
  - la correspondance des catégories Geoapify n'a pas été vérifiée sur l'API réelle (pas de clé) ;
  - Geoapify renvoie 500 lieux au plus par appel : une zone dense peut être mise en cache incomplète ;
  - le cache n'est jamais purgé (une ligne expirée n'est remplacée que si sa case est redemandée) ;
  - **lieux du fond OSM France** : seuls ceux des catégories de la découverte ouvrent une popup (une pharmacie, une boutique ou une église ne donnent rien) ; la position d'un lieu OSM et celle de son icône sur la tuile peuvent différer de quelques pixels (marge de 18 px) ; pas de curseur « main » au survol (les tuiles n'en disent rien) ; le premier clic d'une zone attend la réponse d'Overpass, sans indicateur, et une erreur (503) laisse le clic sans effet ;
  - les pastilles des lieux, dessinées par la carte, ne s'atteignent pas au clavier : la liste « Lieux trouvés » reste le chemin accessible ; leurs couleurs sont lues à l'affichage, comme celles des tracés (un changement de thème ne les met à jour qu'à la recherche suivante).
- **E2E `smoke` du service worker** : instable en exécution parallèle complète, y compris sur `main` (relance nécessaire, précache d'environ 2,2 Mo) ; passe en isolé. Piste : allonger son délai ou le sortir du lot parallèle.
- **Notes d'un dossier** : la fenêtre « Modifier le dossier » (`GroupDialog`, issue #47) ne propose plus que le nom, l'icône et la couleur ; d'éventuelles notes déjà saisies sur un dossier sont gardées en base mais ne s'affichent ni ne se modifient plus (elles n'étaient visibles que dans l'ancien éditeur). Un dossier ne change plus de jour par sa fenêtre : par le menu contextuel ou le glisser-déposer.
- **Réordonner les étapes d'un jour et ranger une étape dans un dossier** ne se font qu'au glisser-déposer, sans équivalent au clavier depuis le retrait des boutons monter / descendre (issue #46) ; changer de jour se fait au clavier par le menu contextuel (touche Menu ou Maj+F10, « Déplacer vers »).
- **Menus contextuels et tablette** : ils s'ouvrent au clic droit ou au clavier (touche Menu, Maj+F10), pas à l'appui long sur iPad (Safari n'émet pas `contextmenu`). Pour les résultats de « Rechercher » et d'« Explorer la zone » (lignes sans bouton depuis le 25/11/2026), la popup du clic gauche garde l'ajout au jour affiché et aux idées ; l'ajout à un autre jour et Google Maps n'y sont pas.
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
  - « Préparer hors ligne » ne télécharge que les tuiles d'OpenFreeMap : en satellite hors ligne, les routes et libellés sont là, l'imagerie seulement pour les zones déjà affichées (cache `satellite-tiles`) ;
  - la carte hors ligne dépend d'OpenFreeMap : l'URL des tuiles est versionnée, une nouvelle version publiée après la préparation n'est pas en cache (il faut préparer de nouveau) ;
  - un quota dépassé pendant la mise en cache par le service worker n'est pas visible de la page ; seule une erreur `QuotaExceededError` remontée au navigateur affiche le message dédié ;
  - un voyage jamais ouvert sur l'appareil n'est pas consultable hors ligne ;
  - non vérifié à la main : consultation hors ligne de la vraie carte (tuiles réelles), PWA installée, mise à jour de l'application avec un voyage en cache.
- **Feuille de route** : tous les lots de l'épique #1 sont livrés.
