# Popups des trajets, des idées et des lieux découverts, comme la référence

- Date : 2026-11-24
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur)

## Demande

Les clics sur les trajets, les lieux des idées et les lieux de l'explorateur doivent cadrer la carte
et ouvrir une popup, comme pour les étapes, en suivant toujours le site de référence
(`C:\MyDatas\Temp\game2`) : pour un lieu découvert, titre, infos, « Ajouter » et « Supprimer », avec
une icône s'il est déjà ajouté ; pour un trajet, infos et « Supprimer ».

## Ce qui a été fait

- Référence relue : `focusRoute` (`fitBounds`, marge 60, zoom 16 au plus, puis popup) et
  `buildRoutePopup` (« mode · calque », nom, « distance · durée », pastille « Tracé direct »,
  Modifier, Supprimer) ; `buildDiscoverPopup` (« catégorie · OpenStreetMap », nom, adresse,
  « Ajouter à mon voyage »).
- `lib/map/popups.ts` (remplace `stepPopup.ts`) : `MapPopupContent` et ses trois constructeurs
  `stepPopupContent`, `legPopupContent`, `poiPopupContent` ; types `PopupTarget` et `FocusTarget`.
- `lib/components/MapPopup.svelte` (remplace `StepPopup.svelte`) : catégorie, nom, notes, ligne
  d'infos avec pastille (cochée pour « Déjà ajouté »), actions (principale en bouton plein).
- `TripMap.svelte` : une seule popup pour tout (`popupFor`, `focus` avec cible typée,
  `onPopupClose(kind)`) ; cadrage par type ; popup au clic sur un tracé de trajet et sur un lieu
  découvert ; l'ancienne infobulle du lieu découvert (nom seul) est retirée ; popup fermée si son
  trajet ou son lieu disparaît.
- `LegTile.svelte` : la tuile d'un trajet reste cliquable en lecture seule.
- Page voyage : `openLeg`, `openPoi`, `popupFor`, `removeLegById` ; `pickPoi` (clic sur la carte)
  ne bascule plus la sélection.

## Décisions et pourquoi

- **Trajet : « Modifier » en plus de « Supprimer »** (choix de l'utilisateur, comme la référence) :
  sinon l'éditeur du trajet (durée forcée, recalcul, notes, réservation) devenait inaccessible
  depuis la liste.
- **Lieu découvert : deux boutons d'ajout** (« Ajouter à J2 », principal, et « Ajouter aux idées »)
  à la place du seul « Ajouter à mon voyage » de la référence, qui ouvrait une fenêtre : l'appli
  ajoute directement, au jour affiché ou aux idées, comme les boutons de la liste.
- **« Supprimer » d'un lieu découvert** : supprime l'étape du voyage qui a le même `osmRef`, avec
  la confirmation habituelle.
- **Type au singulier** (« Musée ») dans la popup d'un lieu découvert, comme les étapes ; les
  catégories de l'explorateur sont au pluriel (« Musées »).
- **Plus de second clic pour désélectionner** un lieu découvert : la popup se ferme par sa croix ou
  un clic sur la carte, ce qui désélectionne.
- **Idées** : déjà traitées par la tâche précédente ; un e2e le couvre maintenant.

## Bugs et pièges rencontrés

- `e2e/poi.spec.ts` « trop loin » : un clic sur « Zoom out » pendant l'animation de cadrage était
  annulé par elle (passe seul, échouait en série) ; le test attend maintenant le zoom 13.
- Les e2e qui ouvraient l'éditeur d'un trajet par sa tuile (`legs.spec.ts`) passent par « Modifier »
  de la popup.

## Tests et vérifications

- TDD, vus en échec avant le code : `popups.test.ts` (10 cas : étape, idée, sans type, trajet,
  pastille estimé et lignes, lieu à ajouter, vue d'ensemble, déjà ajouté, Geoapify, lecture
  seule), `MapPopup.test.ts` (4 cas), `LegTile.test.ts` (tuile cliquable en lecture seule).
- E2E : `step-popup.spec.ts` (trajet : pas d'éditeur, popup « Voiture · J1 », « Musée du Louvre →
  Musée d'Orsay », « 12 km · 25 min », cadrage, Modifier, Supprimer ; idée : popup « · Idée » et
  zoom), `poi.spec.ts` (popup et zoom au clic dans la liste, croix qui désélectionne ; popup
  « Musée · OpenStreetMap », ajout, « Déjà ajouté », Supprimer ; clic sur la carte).
- `pnpm lint`, `pnpm typecheck` propres ; tests web : 334 ; `pnpm test:e2e --workers=2` (build
  compris) : 65 sur 65.

## Revue

- Rien de bloquant relevé.

## Reste à faire

- Rien.
