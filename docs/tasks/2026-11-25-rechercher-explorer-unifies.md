# « Rechercher » dans le panneau gauche, résultats et menu contextuel communs avec « Explorer la zone »

- Date : 2026-11-25
- Type : fonctionnalité (front)
- Issue : aucune

## Demande

- Supprimer le champ flottant « Rechercher un lieu… » de la carte ; ajouter un bouton « Rechercher » (loupe) dans la pilule d'outils, à côté de « Lieu » et « Explorer la zone », les trois alignés à gauche.
- « Rechercher » ouvre le panneau gauche comme « Explorer la zone » : champ avec autocomplétion, résultats groupés par catégorie avec séparateurs, au format de la découverte, sans bouton sur les lignes.
- Clic gauche sur un résultat : zoom et popup sur la carte. Clic droit : menu contextuel (Ajouter aux idées, Ajouter à un jour, Voir dans Google Maps, autres actions pertinentes).
- Même logique pour les résultats d'« Explorer la zone » (boutons « + J2 » et « + Idées » retirés), avec des composants communs.
- Choix de l'utilisateur au vu de la maquette : pas de pastilles sur la carte pour la recherche (popup au clic seulement), et plus de mise en évidence des pastilles de la découverte depuis la liste.

## Ce qui a été fait

- `lib/places/results.ts` (nouveau) : `ResultGroup`, `placeResultGroups` (par type d'étape, ordre de `STEP_TYPES`), `poiResultGroups` (par catégorie de la découverte, sur `groupPoisByCategory`).
- `lib/components/places/` (nouveau) :
  - `ResultRow.svelte` : ligne commune (icône, nom, type ou catégorie et adresse, « Déjà ajouté »), un seul bouton ; clic droit, touche Menu et Maj+F10 vers `onContextMenu` ; détail facultatif (snippet `children`) ;
  - `ResultGroups.svelte` (générique) : titres avec icône, libellé, nombre et filet, une liste par groupe ;
  - `SidePanel.svelte` : panneau gauche avec « Retour au jour » et titre ;
  - `SearchPanel.svelte` : panneau « Rechercher » (`PlaceSearch` et ses résultats groupés), focus sur le champ à l'ouverture.
- `PlaceSearch.svelte` : snippet facultatif `list` pour afficher les résultats autrement ; résultats en `$state.raw`.
- `lib/steps/contextMenu.ts` : `placeMenuEntries` (menu commun) ; `dayTarget` et `googleMapsEntry` partagés avec le menu des étapes.
- `PoiCard.svelte` : repose sur `ResultRow` (boutons d'ajout retirés, détail Wikipédia gardé). `ExplorePanel.svelte` : `SidePanel` et `ResultGroups` ; props `dayLabel`, `canEdit`, `onAdd`, `onHover` remplacées par `onContextMenu`.
- `TripMap.svelte` : champ flottant et sa requête de conteneur retirés ; pilule en haut à gauche (`--map-tools-inset` pour la décaler) ; outil « Rechercher » (`searching`, `onToggleSearch`) ; cadrage et popup d'un `FocusTarget` `place` ; prop `selectedPoi` retirée (seul le survol d'une pastille sur la carte la met en évidence).
- `lib/map/popups.ts` : `FocusTarget` `place`.
- Page voyage : `sidePanel` (`'explore' | 'search' | null`) à la place de `exploring` (devenu dérivé), `toggleSidePanel`, `selectedPlace`, `openPlace`, `openPlaceMenu` (et `openPoiMenu`, `openSearchMenu`) ; `addPoi(poi, dayId)` ; en « Plein écran », la pilule se décale de la largeur du panneau (`--side-panel-width`).
- `docs/specification.md` : §1 (ajout d'un lieu, découverte, nouvelle section « Recherche »), §2 (pilule de la carte), §8 (décision).

## Décisions et pourquoi

- **Menu commun = règle de la popup** : pas encore dans le voyage, « Ajouter aux idées » et « Ajouter à un jour » ; déjà ajouté (même `osmRef`), « Supprimer » (confirmé). La découverte n'avait pas de menu contextuel ; les « autres actions pertinentes » existantes étaient celles de sa popup.
- **« Ajouter à un jour » propose tous les jours** (sous-menu avec dates, comme « Déplacer vers »), et non plus seulement le jour affiché.
- **Groupes de la recherche par type d'étape** : Photon ne donne pas de catégorie de la découverte (hôtel, gare, aéroport…) ; libellés des types (`STEP_TYPE_INFO`).
- **Détail Wikipédia gardé** au clic dans la découverte : fonctionnalité existante, sans bouton d'action.
- **« Rechercher » en lecture seule** : chercher et ouvrir Google Maps reste utile ; seulement en ligne (géocodage par l'API), comme « Explorer la zone ».
- **Tracés des trajets gardés pendant la recherche** (masqués seulement pendant l'exploration, à cause des pastilles).
- **Identité des résultats** : `selectedPlace` et les résultats de `PlaceSearch` en `$state.raw`, sinon le proxy profond de Svelte casse la comparaison `place === selected`.

## Bugs et pièges rencontrés

- Python sous Windows écrit les fins de ligne en CRLF en mode texte : écrire avec `newline=''` (ou repasser Prettier).
- Une espace insécable littérale dans un gabarit est refusée par ESLint (`no-irregular-whitespace`).

## Tests et vérifications

- TDD, vus en échec avant le code (modules absents ou comportements manquants) :
  - `lib/places/results.test.ts` (4 cas : ordre des types, doublons gardés, vide, groupes de la découverte) ;
  - `steps/contextMenu.test.ts` (`placeMenuEntries`, 4 cas : pas ajouté, déjà ajouté, voyage sans jour, lecture seule) ;
  - `components/places/SearchPanel.test.ts` (6 cas : panneau et focus, groupes, aucun bouton et « Déjà ajouté », clic gauche et droit, sélection, aucun résultat) ;
  - `ExplorePanel.test.ts` : boutons d'ajout remplacés par « aucun bouton sur les lignes », clic droit, Maj+F10 ; puis, après la revue, clic droit dans le détail déplié (vu en échec).
- E2E :
  - `e2e/search.spec.ts` (nouveau, 4 cas, vus en échec sur l'ancien code) : pilule à gauche sans champ flottant ; panneau, groupes, clic gauche (popup, zoom 15), bascule vers Explorer, retour au jour ; menu (Google Maps intercepté, J2, idées, Supprimer confirmé) ; plein écran, outils non masqués par le panneau ;
  - `poi.spec.ts` : ajout à J2 par le menu ; sélection sans mise en évidence de la pastille (survol compris) ; nouveau test du menu d'un lieu découvert ;
  - `new-place`, `step-popup`, `steps` : l'ancien champ remplacé par le bouton « Lieu ».
- `pnpm lint`, `svelte-check` propres. Unitaires : core 242, API 200, web 466.
- E2E complets `--workers=2` (ports 8795 et 8805, build compris) : 93 sur 93 ; après les corrections de la revue, specs touchées (`poi`, `search`, `context-menu`, `step-popup`, `new-place`, `layouts`) : 38 sur 38.
- Captures à 1280 px (spec temporaire, supprimée) : pilule à gauche ; panneau « Rechercher », groupes, menu et sous-menu, popup du résultat. Non vérifiés à l'œil : thèmes sombre et Carnet, taille d'affichage 80 / 90 %, tablette réelle.

## Revue

- Revue indépendante (relecteur Opus), points corrigés :
  - clic droit posé sur toute la ligne, détail déplié compris : un lien Wikipédia ou du site perdait le menu du navigateur. Déplacé sur `.row` (test ajouté, vu en échec) ;
  - `mapFocus` en `$state` profond : le lieu recherché y devenait un proxy. Passé en `$state.raw` ;
  - assertion e2e du survol qui passait dès la première lecture : attente de deux images avant la vérification.
- Écartés ou laissés :
  - une popup qui en remplace une autre ne désélectionne pas la ligne (`closePopup(false)`) : comportement existant et voulu (§1 de la spécification), sinon la nouvelle sélection serait effacée aussitôt ;
  - la popup d'un résultat reste ouverte après « Retour au jour » (comme celle d'un clic droit sur la carte) ;
  - le menu contextuel ne s'ouvre pas à l'appui long sur iPad (Safari n'émet pas `contextmenu`) : limite commune à tous les menus des lieux depuis #46 ; la popup (clic gauche) garde « Ajouter à J… » et « Ajouter aux idées ».

## Reste à faire

- Éventuellement : appui long tactile pour les menus contextuels des lieux (tous, pas seulement les résultats).
