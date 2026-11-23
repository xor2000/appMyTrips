# Clic sur un lieu : sélection, zoom et popup comme la référence

- Date : 2026-11-24
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur)

## Demande

Le clic sur un lieu de la colonne de gauche ne doit plus ouvrir l'édition : il sélectionne le lieu,
zoome dessus et ouvre la même popup que sur le site de référence (`C:\MyDatas\Temp\game2`), avec
les mêmes informations et les mêmes boutons.

## Ce qui a été fait

- Référence (`js/app.js`, `focusPoi` et `buildPoiPopup`) : `flyTo` au zoom max(zoom, 15) puis
  popup « CATÉGORIE · calque », nom (`h4`), notes, boutons « Modifier » et « Supprimer ».
- `lib/map/stepPopup.ts` (nouveau) : `stepPopupInfo(step, days)` : type (« Lieu » sans type), jour
  (« J2 », « Idée » sans jour), nom, notes, couleur du type.
- `lib/components/StepPopup.svelte` (nouveau) : contenu de la popup, styles de la référence
  (catégorie 10,5 px majuscules dans la couleur du type, nom 15 px gras, notes, deux boutons à
  parts égales) ; boutons seulement pour qui peut modifier.
- `TripMap.svelte` : props `stepPopup`, `canEdit`, `onEditStep`, `onDeleteStep`, `focus`,
  `onPopupClose`. Le composant est monté (`mount`) dans une `maplibregl.Popup` (classe
  `step-map-popup`, coins de 14 px) et démonté à sa fermeture. `focus` : `flyTo` et popup. Un clic
  sur un marqueur ouvre aussi la popup (en plus du défilement vers la carte de la timeline). La
  popup se ferme si son point disparaît. `window.__mapZoomForTests` pour les e2e.
- Page voyage : `openStep` pour la timeline de l'affichage « Liste » et la colonne des idées ;
  `selectedKey` garde la mise en évidence tant que la popup est ouverte ; « Modifier » ouvre
  l'éditeur, « Supprimer » la confirmation habituelle.

## Décisions et pourquoi

- **Libellé de jour « J1 »** (et non « Jour 1 » de la référence) : celui des onglets de l'appli ;
  « Idée » pour une étape sans jour.
- **Repli sur l'éditeur** sans point sur la carte (dossier, étape sans lieu) et en plein écran
  (carte masquée) : sinon le clic ne ferait rien de visible.
- **Ligne de métro inchangée** : la demande vise la colonne de gauche ; les stations ouvrent
  toujours l'éditeur (la colonne des idées, elle, suit la nouvelle règle partout où la carte est
  visible).
- **Séjours (« H »)** inchangés : leur clic ouvre toujours la fenêtre du séjour.
- **Composant Svelte monté dans la popup** plutôt que du HTML construit à la main : textes échappés
  par Svelte (nom et notes viennent de l'utilisateur ou d'OpenStreetMap), testable seul.

## Bugs et pièges rencontrés

- Plusieurs e2e ouvraient l'éditeur en cliquant la carte d'étape (`steps`, `schedule`, `gpx`,
  `poi`) : ils passent maintenant par « Modifier » de la popup.

## Tests et vérifications

- TDD, vus en échec avant le code (modules absents) : `stepPopup.test.ts` (4 cas) et
  `StepPopup.test.ts` (4 cas : en-tête, sans notes ni jour, boutons, lecture seule).
- E2E : `e2e/step-popup.spec.ts` (clic sur la carte d'étape : pas d'éditeur, popup « Musée · J1 »,
  nom, boutons, zoom ≥ 15, carte mise en évidence ; « Modifier » ouvre l'éditeur ; « Supprimer »
  demande confirmation ; clic sur un marqueur : même popup). Pas lancé avant le code (la suite
  demande un build).
- `pnpm lint`, `pnpm typecheck` propres ; tests web : 327 ; e2e ciblés (`step-popup`, `steps`,
  `gpx`, `poi`, `schedule`, `map-styles`, `layouts`) avec `--workers=1` : 28 sur 28.
- Capture (1280 px) : popup au-dessus du marqueur, « MUSÉE · J1 », nom, « Modifier » et
  « Supprimer », carte d'Orsay mise en évidence dans la timeline.

## Revue

- Corrigé : en passant d'un lieu à un autre, la fermeture de l'ancienne popup prévenait la page et
  effaçait la sélection du nouveau lieu. `closeStepPopup(false)` quand une popup en remplace une
  autre ; e2e « passer d'un lieu à l'autre garde la sélection du nouveau », vu en échec avant la
  correction. Suite complète avant la correction : 61 sur 61 ; après : `step-popup`, `steps`,
  `map-styles` 14 sur 14, tests unitaires (core 234, API 192, web 327). Laissé : le défilement de la timeline au clic sur un marqueur existait déjà et
  reste.

## Reste à faire

- Rien.
