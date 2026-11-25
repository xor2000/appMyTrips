# Bouton « Lieu » sur la carte et fenêtre de création ; boutons d'ajout retirés

- Date : 2026-11-25
- Type : fonctionnalité (front)
- Issue : #48 (lot 3/4 de l'harmonisation des lieux ; lots précédents #46, #47)

## Demande

- Retirer sous les lieux du jour « Ajouter un lieu », « Ajouter un séjour » et « Importer une randonnée ».
- Ajouter un bouton « Lieu » sur la carte, avec l'icône de la référence.
- Ce bouton ouvre une fenêtre pour créer un lieu : par des coordonnées GPS, un clic sur la carte ou la recherche. Ensuite, un formulaire comme la fenêtre de modification complète les informations.
- Les catégories gagnent « Séjour », pour un hébergement sur plusieurs jours.

## Ce qui a été fait

- `lib/steps/coords.ts` (nouveau) :
  - `parseLatLng` : deux champs, ou un couple « lat, lng » collé ; degrés décimaux, bornes vérifiées ;
  - `samePoint` : même point à 6 décimales.
- `NewPlaceDialog.svelte` (nouveau), fenêtre « Ajouter un lieu » :
  - onglets `.seg` « Rechercher » (`PlaceSearch`), « Sur la carte » (masquée pendant le choix, absent sans carte) et « Coordonnées » ;
  - un point est situé par `locate`, c'est-à-dire `findPlaceAt` de la page (Photon, sinon « Point sur la carte ») ;
  - une réponse tardive après fermeture est ignorée.
- `StepEditor.svelte`, mode création (`mode="create"`) : fenêtre « Nouveau lieu », bouton « Ajouter », sans « Supprimer ».
  - Brouillon tiré du lieu choisi ; la durée suit la catégorie tant qu'elle n'est pas saisie (envoyée seulement si saisie).
  - Catégorie « Séjour » (icône calendrier) : champs d'un séjour (arrivée le et à, départ le et à, réservation), contrôle des dates, `NewPlaceResult` de type `stay`.
  - Catégorie « Randonnée » : import GPX dans le navigateur (`readGpx`), envoyé avec l'étape.
  - `onSave` et `onDelete` facultatifs.
- `TripMap.svelte` : outil « Lieu » (`MapPin`, prop `onAddPlace`) en tête de la pilule d'outils. Le champ de recherche ouvre la même fenêtre.
- Page voyage :
  - `openNewPlace`, `chooseNewPlace` (ignoré si la fenêtre a été fermée), `placeDraft`, `createNewPlace` ;
  - point déplacé ou randonnée au début de son tracé : nouvelle adresse par géocodage inverse, et `osmRef` retiré ;
  - `mapVisible` : choix sur la carte impossible en « Plein écran » sur la timeline ;
  - barre d'ajout (`addBar`, CSS compris), `addPlace`, `pickHikeFile` et la création de séjour par `StayDialog` retirés ;
  - l'effet qui abandonne un choix sur la carte tient compte des deux nouvelles fenêtres.
- `StayDialog` : modification seulement (création retirée). `AddPlaceDialog` et son test sont supprimés.
- Textes du jour vide (`Timeline`, `MetroLine`) : renvoi au bouton « Lieu ».
- E2E :
  - helper `addPlaceViaMap` (`e2e/place-helpers.ts`) ;
  - specs migrées : `context-menu`, `folders`, `layouts` (plein écran par le mode Carte), `legs`, `offline`, `poi`, `schedule`, `step-popup`, `steps` ;
  - le test du séjour (`steps.spec.ts`) et celui de l'import GPX par le bouton (`gpx.spec.ts`) sont repris dans `new-place.spec.ts`.

## Décisions et pourquoi

- **Formulaire de création = éditeur d'étape en mode création**, pour ne pas maintenir deux formulaires de lieu.
- **« Séjour » seulement à la création** : un séjour est un autre objet (table `stays`, plusieurs nuits) ; transformer une étape en séjour n'est pas proposé.
- **Le nom de la fenêtre « Ajouter un lieu » est gardé** pour l'étape 1, avec le même champ de recherche : la migration des e2e est réduite.
- **Plein écran** : sans carte, pas de bouton « Lieu » ; on ajoute en mode Carte, en choisissant le jour.
- **Séjour sans notes** : ni `StayDialog` ni `StayCard` n'en affichent ; les saisir aurait été un texte perdu.

## Bugs et pièges rencontrés

- `getByLabel('Jour')` attrape aussi la case « Séjour » (recherche partielle), et `exact: true` ne trouve plus le `<select>` : son nom calculé contient l'option affichée (« Jour J1 · … »). Cibler par `getByLabel(/^Jour/)`.
- Sur une machine chargée, des e2e sans rapport (GPX glissé, trajets) dépassent leurs délais en exécution parallèle (suite à 7,6 min au lieu de 4,6). Relancés : verts.

## Tests et vérifications

- TDD, vus en échec avant le code :
  - `coords.test.ts` (`parseLatLng`, puis `samePoint` ajouté pour la revue) ;
  - `NewPlaceDialog.test.ts` (8 cas : onglets, recherche, coordonnées, coordonnées invalides, carte, abandon, sans carte) ;
  - `StepEditor.test.ts` (6 cas de création : fenêtre, envoi et durée par défaut, durée saisie, séjour, dates de séjour, GPX).
- Ajoutés avec les correctifs de la revue, sans les voir échouer avant (le correctif était déjà écrit) : réponse tardive ignorée, onglet « Sur la carte » demandé sans carte.
- E2E `new-place.spec.ts` (7 cas) :
  - plus de boutons d'ajout dans les trois affichages ;
  - recherche ; coordonnées vers les idées ; choix sur la carte ;
  - séjour de 2 nuits ; randonnée avec GPX ;
  - recherche de la carte sur « Tout le voyage » (idées par défaut).
- `pnpm lint` et `pnpm typecheck` propres.
- Tests unitaires : core 242, API 200, web 446.
- E2E complets `--workers=2` (ports 8795 et 8805, build compris) : 86 sur 86, après les correctifs de la revue.
- Non vérifié à la main : rendu des fenêtres dans les thèmes sombre et Carnet (les e2e et les tests de composants couvrent le comportement).

## Revue

- Auto-revue : une réponse tardive du géocodage après fermeture de la fenêtre aurait rouvert « Nouveau lieu » (garde dans `chooseNewPlace`, puis dans `NewPlaceDialog`).
- Revue indépendante (relecteur Opus), points confirmés et corrigés :
  - **important** : comparaison d'un point arrondi (6 décimales) à la coordonnée brute de Photon. Presque chaque ajout aurait été vu comme déplacé, avec une adresse remplacée par celle d'un voisin. Corrigé par `samePoint` ;
  - **important** : notes de séjour saisies puis invisibles (champ retiré pour un séjour) ;
  - mineurs : `osmRef` retiré quand le point est déplacé ; adresse d'une randonnée GPX prise au début du tracé ; lien de réservation plus contrôlé pour un séjour ; `onSave` facultatif ; onglet « Sur la carte » sans carte ; réponse tardive après fermeture puis réouverture ; branche de création morte de `StayDialog`.
- Laissé : la durée affichée d'une randonnée avec GPX est celle de la catégorie, alors que l'API la calcule depuis le tracé (l'aide de la fenêtre le dit).

## Reste à faire

- Lot #49 (Explorer la zone).
