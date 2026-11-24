# Liste des voyages avec vignettes, lieux du fond OSM France cliquables

- Date : 2026-11-24
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur, transmise par une autre session)

## Demande

1. Rendre la liste déroulante de choix du voyage (en-tête) plus soignée, avec une petite vignette
   de la photo de chaque voyage.
2. Sur la carte, avec le fond « Plan OSM France », ouvrir la fenêtre d'information et d'ajout de la
   découverte en cliquant sur les lieux dessinés par le fond.

## Ce qui a été fait

- `lib/components/TripSwitcher.svelte` : la `<select>` native devient une liste personnalisée
  (motif WAI-ARIA « combobox à liste seule ») : bouton `role="combobox"` « Choisir un voyage »
  avec vignette (26 px) et nom du voyage ouvert ; liste `role="listbox"` « Voyages » sous le bouton,
  groupes « En cours et à venir » / « Souvenirs » (`groupTrips`), options avec vignette (44 px),
  nom et dates (`formatPeriod`), voyage ouvert coché. Clavier sur le bouton (flèches avec bouclage,
  Début, Fin, Entrée, Espace, Échap, Tab), option active par `aria-activedescendant`, survol, clic
  extérieur. Vignette : `cover.thumbUrl`, sinon (ou image en erreur) initiale sur une couleur des
  trajets du thème (`legColorVar`, stable par identifiant). Ouverture en fondu de 140 ms, coupée
  avec `prefers-reduced-motion`.
- `lib/map/basemapPois.ts` (nouveau) : `basemapPoisClickable(fond, zoom)` (fond `osmfr`, zoom ≥ 15),
  `BASEMAP_POI_TOLERANCE_PX` (18 px), `createBasemapPoiFinder(fetchArea)` : lieux d'une zone de clic
  à partir des cases du zoom 13 du cache de la découverte, chaque case demandée une fois (promesse
  partagée, erreur non gardée).
- `TripMap.svelte` : prop `findBasemapPois` ; un clic sans marqueur, tracé de trajet ni lieu
  découvert, sur le fond OSM France assez zoomé, cherche les lieux dans ± 18 px et ouvre la popup
  « Lieu découvert » du plus proche (`closestPoiId`). Recherche ignorée si un autre clic, un
  déplacement ou un changement de fond est intervenu (`basemapClick`). Une popup de lieu du fond
  (`popupRef.basemap`) n'est pas fermée par l'effet qui ferme les lieux sortis de la découverte.
- Page voyage : `findBasemapPois` = `explorePois` sur toutes les catégories (`POI_CATEGORIES`),
  en ligne seulement ; la popup réutilise `poiPopupContent` et `addPoi` (« Ajouter à J1 »,
  « Ajouter aux idées », « Déjà ajouté » et « Supprimer »).
- `docs/specification.md` : en-tête, clic sur les lieux du fond, décisions, limites.

## Décisions et pourquoi

- **Liste personnalisée plutôt que native** : une `<option>` ne peut pas contenir d'image. Motif
  « combobox à liste seule » (focus sur le bouton) : même nom accessible qu'avant, et le motif
  clavier attendu d'une liste déroulante.
- **Initiale colorée sans photo** : la plupart des voyages n'ont pas de photo ; une case vide ou une
  icône générique répétée ne distinguerait rien. Couleurs des trajets du thème : aucune couleur en
  dur, suivi du thème.
- **Lieux du fond par la découverte** : les tuiles d'OSM France sont des images (aucune donnée
  sous le clic). Écartés : une couche vectorielle invisible d'OpenFreeMap (autres règles de rendu
  que le fond, pas d'adresse ni de référence OSM fiable pour « Déjà ajouté ») et une requête
  Overpass `around` à chaque clic (latence, politique d'usage). La route `/api/poi` et son cache
  (case du zoom 13, 7 jours) donnent les mêmes `Poi` que la découverte : popup et ajout identiques
  sans code nouveau côté API, secours Geoapify compris.
- **Zoom 15 minimum** : en dessous, le fond dessine peu de lieux et la marge de 18 px couvrirait
  une zone trop large.
- **Rien n'est affiché si aucun lieu n'est trouvé** ou en cas d'erreur : un clic sur la carte sert
  aussi à la déplacer ou à fermer une popup ; un message à chaque clic dans le vide gênerait.

## Bugs et pièges rencontrés

- Le worktree n'avait pas de `node_modules` : `pnpm install --frozen-lockfile` avant les tests.
- Les options de la liste n'existent que liste ouverte : les e2e qui cherchaient
  `combobox.getByRole('option')` (`offline`, `trips`) ouvrent d'abord la liste ; après la
  suppression d'un voyage, la liste peut être absente (plus aucun voyage) : attendre la liste ou
  l'écran « Aucun voyage » avant de vérifier.

## Tests et vérifications

- TDD, vus en échec avant le code :
  - `TripSwitcher.test.ts` (11 cas, 7 en échec contre la `<select>`) : vignette et initiale, image
    en erreur, groupes et dates, voyage coché, clic, voyage courant, clavier complet, Échap et clic
    extérieur, hors d'un voyage, roue et « + », aucun voyage ;
  - `basemapPois.test.ts` (6 cas, module absent) : fond et zoom, recherche par case et filtre de
    la zone, case gardée, clic à cheval sur deux cases, erreur non gardée, deux clics simultanés.
- E2E : `header.spec.ts` (liste ouverte : option cochée, dates, vignette, position sous le bouton,
  choix au clic ; clavier et Échap), `home.spec.ts` (vignette de la photo dans le bouton et la
  liste), `offline.spec.ts` et `trips.spec.ts` adaptés ; `poi.spec.ts` : « fond OSM France : clic sur
  un lieu dessiné par le fond » (pas de recherche sur le fond Plan ; popup du Musée des Arts
  décoratifs avec adresse et « Ajouter à J1 » ; second lieu de la même case sans nouvelle requête ;
  rien loin d'un lieu ; ajout aux idées ; « Déjà ajouté »). Pas lancés avant le code (la suite
  demande un build) : les anciennes `<select>` et l'absence de clic sur le fond les feraient échouer.
- Ajouté à la revue (vu en échec avant le correctif) : « à l'ouverture, le voyage coché est amené
  en vue » (`scrollIntoView` de l'option active à l'ouverture, utile pour une longue liste).
- `pnpm lint`, `pnpm typecheck` propres ; `pnpm test` : core 239, API 197, web 389.
- `pnpm test:e2e --workers=2` (ports 8795/8805, build compris) : 73 sur 73. Avant, lot ciblé : la
  dernière étape du nouvel e2e cherchait « Déjà ajouté » au clic sur le lieu ajouté, mais le marqueur
  de l'idée recouvre alors le lieu et ouvre la popup de l'idée (comportement voulu) : test corrigé.
  Deux tests de la découverte (`toHaveCount(3)` à 5 s) et « trop loin » (zoom initial 14 au lieu de 13) ont échoué une fois en parallèle puis passé : délais sous charge, sans lien avec le changement.
- Après la retouche du défilement : `header`, `home`, `trips`, `offline` : 20 sur 20.
- Captures (build servi par `wrangler dev`, 1280 px) : liste ouverte (groupes, vignette photo,
  initiales colorées, dates, voyage coché) ; popup « MUSÉE · OPENSTREETMAP », « Musée des Arts
  décoratifs », adresse, « Ajouter à J1 » et « Ajouter aux idées » sur le fond OSM France.
- Non vérifié : tuiles réelles d'OSM France (interceptées en e2e) et Overpass réel ; écart réel
  entre l'icône dessinée et la position OSM.

## Revue

- Corrigé : l'option cochée n'était pas amenée en vue à l'ouverture d'une longue liste.
- Vérifié sans correction : clic sur un tracé de trajet (pas de recherche), recherche dépassée par
  un autre clic ou un déplacement, popup d'un lieu du fond non fermée par l'effet de la découverte,
  rien hors ligne, couleurs uniquement par variables du thème, textes échappés par Svelte.
- Laissé (noté dans les limites de la spécification) : lieux hors catégories de la découverte non
  cliquables ; pas d'indicateur pendant le premier appel d'une zone ; erreur silencieuse.

## Reste à faire

- Rien.
