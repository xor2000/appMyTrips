# Clic droit sur la carte : popup du lieu trouvé avant l'ajout

- Date : 2026-11-24
- Type : correction (comportement)
- Issue : aucune (demande de l'utilisateur)

## Demande

Un clic droit dans une zone vide puis « Ajouter ici » ajoutait aux idées une école voisine, alors
qu'aucun lieu n'était dessiné sous le clic. Demande : au clic droit, afficher à la place la même
popup que pour un lieu découvert (Geoapify / Overpass), avec le résultat de Photon déjà utilisé par
« Ajouter ici ».

## Cause

« Ajouter ici » appelait `/api/geocode/reverse` (Photon `/reverse`, `limit: 1`, sans rayon) et
créait aussitôt l'étape avec le nom, le type, l'adresse et l'`osmRef` du lieu OSM le plus proche,
quelle que soit sa distance. Rien ne montrait ce lieu avant l'ajout.

## Ce qui a été fait

- `lib/map/popups.ts` : cible de popup `{ kind: 'place', place: Place }` ; `placeAtPoint`
  (lieu de Photon placé au point cliqué, sinon « Point sur la carte », type « Autre ») ;
  `placePopupContent` (même contenu que `poiPopupContent` : « TYPE · OpenStreetMap », nom, adresse,
  « Ajouter à J1 » / « Ajouter aux idées », « Déjà ajouté » et « Supprimer »). Les deux partagent
  `addablePlaceContent`.
- `TripMap.svelte` : le menu « Ajouter ici » (état `menu`, bouton, styles) disparaît ; prop
  `findPlaceAt` à la place de `onAddHere` ; le clic droit ouvre la popup `place` au point cliqué
  (`openPlaceAt`). Le compteur `basemapClick` devient `clickSeq` : une réponse dépassée par un autre
  clic, clic droit ou déplacement est ignorée.
- Page voyage : `findPlaceAt` (`reversePlace` puis `placeAtPoint`, jamais en échec), `addMapPlace`
  (jour affiché ou idées) ; `popupFor` traite `place` (« Déjà ajouté » par `osmRef`) ; la fermeture
  d'une popup `place` ne touche pas la sélection.
- `e2e/map-helpers.ts` : `clickMapAt(page, lngLat, { button: 'right' })`.
- `docs/specification.md` : clic droit (section carte) et décision.

## Décisions et pourquoi

- **Étape au point cliqué**, pas à la position du lieu de Photon : pour une rue ou une ville,
  Photon renvoie un point parfois éloigné du clic ; « ici » reste le point voulu. La popup aussi
  est ancrée au point cliqué.
- **« Point sur la carte » gardé** quand Photon ne trouve rien ou est injoignable (hors ligne) :
  le clic droit permet toujours d'ajouter un point.
- Pas de limite de distance ajoutée : la popup montre le lieu trouvé, l'utilisateur décide.

## Tests et vérifications

- TDD : `popups.test.ts`, 5 cas vus en échec (fonctions absentes) : lieu placé au point cliqué,
  « Point sur la carte », popup avec ajout au jour et aux idées, point sans lieu sans mention
  OpenStreetMap, « Déjà ajouté ».
- E2E `step-popup.spec.ts` : « clic droit sur la carte : popup du lieu trouvé par Photon, ajout au
  jour » (popup « Lieu sur la carte », « Autre · OpenStreetMap », adresse, plus de bouton
  « Ajouter ici », ajout à J1, second clic droit : « Déjà ajouté »). Écrit avant le code mais non
  lancé avant (la suite demande un build).
- `pnpm lint` et `pnpm typecheck` propres ; tests web : 394 sur 394 (core et API non touchés).
- `pnpm test:e2e --workers=2` (ports 8795/8805, build compris) : 74 sur 74.
- Non vérifié : Photon réel (géocodage inverse factice en e2e).

## Bugs et pièges rencontrés

- La page voyage avait déjà une fonction `addPlace` (ajout depuis la recherche de lieu, qui ferme
  la fenêtre d'ajout) : la nouvelle s'appelle `addMapPlace`.

## Revue

- Vérifié : lecture seule (pas de `findPlaceAt`, clic droit sans effet), choix d'une position en
  cours (clic droit ignoré), réponse dépassée ignorée, popup `place` non fermée par l'effet de la
  découverte, « Déjà ajouté » par `osmRef`.
- Laissé : aucun indicateur pendant l'appel à Photon (popup affichée à la réponse).

## Reste à faire

- Rien.
