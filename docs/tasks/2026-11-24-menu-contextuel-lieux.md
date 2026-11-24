# Menu contextuel des lieux, flèches retirées, popups et marqueurs d'idées harmonisés

- Date : 2026-11-24
- Type : fonctionnalité (front)
- Issue : #46 (lot 1/4 de l'harmonisation des lieux ; lots suivants #47, #48, #49)

## Demande

Mêmes gestes pour tous les lieux des jours et des idées :

- survol : mise en évidence sur la carte ;
- clic gauche : zoom et popup (inchangé) ;
- clic droit : menu contextuel au style de la référence, avec une icône par élément : Modifier, Supprimer, Déplacer vers (Idées, J1, J2…, sans l'endroit actuel), Voir dans Google Maps.

Retirer les actions au survol (corbeille, monter, descendre), y compris dans la ligne de métro. Marqueurs d'idées : icône de la catégorie à la place de l'ampoule. Popup d'un lieu : présentation de celle du clic droit (Photon), avec l'icône de la catégorie.

## Ce qui a été fait

- `lib/steps/contextMenu.ts` (nouveau) :
  - `moveTargets` : destinations sans l'endroit actuel ;
  - `googleMapsUrl` ;
  - `moveToEndOp` : opération de lot, fin des racines, hors dossier ;
  - `stepMenuEntries` : entrées du menu selon le rôle et le type ;
  - `contextMenuKey` : touche Menu et Maj+F10.
- `lib/components/ContextMenu.svelte` (nouveau) :
  - `role="menu"`, entrées action, lien ou sous-menu ;
  - sous-menu « Déplacer vers » défilant, ouvert à gauche faute de place ;
  - clavier : flèches, Début, Fin, droite, gauche, Échap, Tab ;
  - fermeture au clic extérieur et au redimensionnement ;
  - position au pointeur bornée à la fenêtre et divisée par `--zoom` ;
  - style du `.basemap-menu` de la référence.
- `StepCard`, `MetroStop` : actions au survol retirées. `oncontextmenu` sur la carte ou la station, touche Menu et Maj+F10 sur le bouton principal.
- `GroupCard` et dossiers de `MetroLine` : le clic droit sur l'en-tête ouvre le menu du dossier.
- `Timeline`, `IdeasPanel`, `MetroLine` : props `onMove` et `onDelete` remplacées par `onContextMenu`.
- `TripMap.svelte` :
  - clic droit sur un marqueur d'étape ou d'idée : `onMarkerContextMenu`, sans remonter à la carte ;
  - idées : icône du type (`stepIconSvg`, refaite seulement si le type change, `data-icon`) à la place de l'ampoule (`lightbulbIcon` supprimé).
- `map/points.ts` : `MapPoint.type`.
- `map/popups.ts`, `MapPopup.svelte` : la popup d'une étape ou d'une idée a l'icône du type à gauche du nom et une ligne d'adresse avant les notes.
- Page voyage : état `contextMenu`, `openContextMenu`, `moveStepTo` (par `runCommand`, donc annulable), `openMarkerMenu`. Fonction `move` supprimée.
- `lib/steps/moves.ts` : `positionShift` supprimé (plus d'appelant).
- `docs/specification.md` : §1 (règles communes et menu, marqueurs d'idées, popup, métro), §2 (timeline sans actions au survol), §4 (annuler et rétablir), §8 (décision), §9 (réordonner seulement au glisser-déposer).

## Décisions et pourquoi

- **Style du menu** : la maquette de référence n'a pas de menu contextuel. Le menu reprend son menu des fonds, déjà copié par `BasemapPicker`.
- **Sous-menu « Déplacer vers »** (choix de l'utilisateur) : un voyage peut compter 90 jours.
- **Destination exclue** : le jour de l'élément, même s'il est rangé dans un dossier. Sortir une étape de son dossier reste un glisser-déposer.
- **Destination : fin des racines, hors de tout dossier.** C'est le comportement du dépôt sur un onglet de jour (`dropOnDay`).
- **Lien `<a target="_blank" rel="noopener noreferrer">`** pour Google Maps plutôt que `window.open` : le comportement natif (clic milieu, copie du lien) est gardé, et c'est testable sans fenêtre.
- **Lecture seule** : Google Maps seul. Un dossier en lecture seule n'a pas de menu (aucune entrée).
- **Clic droit sur un marqueur** : même menu ; plus de popup Photon par-dessus. Rien sur un séjour.
- **Ligne de métro alignée** (choix de l'utilisateur) : menu contextuel, flèches plus tôt et plus tard retirées.

## Bugs et pièges rencontrés

- **Survol sans effet sur la carte (bug préexistant, demandé par l'issue)** : l'effet de `TripMap` qui pose `highlighted` sur les marqueurs ne lisait la prop qu'à l'intérieur de la boucle sur `markers`, une `Map` non réactive. Au premier passage, la carte charge encore et il n'y a aucun marqueur : l'effet n'avait aucune dépendance et ne se relançait jamais. Correction : lire `highlighted` (ainsi que `map` et `points`) avant la boucle. Vu en échec par l'e2e de survol.
- **Sous-menu refermé au clic** : le survol de « Déplacer vers » l'ouvre déjà, et le clic qui suit le basculait fermé. Le clic l'ouvre toujours désormais ; flèche gauche et Échap le referment. Test unitaire ajouté, vu en échec.

- `svelte/no-navigation-without-resolve` refuse un `href` externe. `eslint-disable-next-line` ne couvre que la ligne de `<a` : il faut un bloc `eslint-disable` / `eslint-enable` autour de l'élément (Prettier met `href` sur sa propre ligne).

## Tests et vérifications

- TDD, tous vus en échec avant le code (modules absents ou comportements manquants) :
  - `steps/contextMenu.test.ts` (9 cas) ;
  - `components/ContextMenu.test.ts` (8 cas : nom, icônes, focus, position, action, flèches, sous-menu, lien, Échap, clic extérieur) ;
  - `StepCard.test.ts` (plus d'actions, clic droit au pointeur, touche Menu et Maj+F10) ;
  - `MetroLine.test.ts` (clic droit sur une station et sur un dossier, plus de flèches) ;
  - `popups.test.ts` et `MapPopup.test.ts` (icône, adresse avant les notes) ;
  - `points.test.ts` (type des idées).
- E2E `e2e/context-menu.spec.ts` :
  - survol et marqueur mis en évidence ;
  - menu, sous-menu sans J1, déplacement vers les idées, Ctrl+Z ;
  - Modifier, Supprimer confirmé, Google Maps dans un nouvel onglet (route interceptée), Échap ;
  - marqueur, idée (icône `museum`), dossier ;
  - ligne de métro.
- E2E existants adaptés (« Monter », « Supprimer … » au survol, « Plus tard ») : `steps.spec.ts`, `legs.spec.ts`, `layouts.spec.ts`.
- `pnpm lint` et `pnpm typecheck` propres. Tests unitaires : core 239, API 197, web 421, tous verts.
- `npx playwright test --workers=2` (ports 8795 et 8805, build compris) : 79 sur 79. Après le dernier correctif (`{#key}`) : `context-menu.spec.ts` 6 sur 6.
- Captures à 1280 px (spec temporaire, supprimée), en Pastel clair, Pastel sombre et Carnet : menu et sous-menu à côté de la carte, marqueur d'idée avec l'icône du musée, popup d'idée avec icône et adresse.
- Non vérifié : taille d'affichage à 80 et 90 % (la division par `--zoom` n'est pas couverte par un test) ; le vrai Google Maps (route interceptée en e2e).
- Piège d'exécution : `pnpm test:e2e -- <filtres>` passe le `--` à Playwright, qui ignore alors les filtres et lance toute la suite. Utiliser `npx playwright test e2e/x.spec.ts`.

## Revue

- Corrigé : un nouveau clic droit pendant qu'un menu est ouvert le recrée au nouveau pointeur (`{#key contextMenu}` dans la page), au lieu de garder l'ancienne position.
- Corrigé : les deux bugs ci-dessus (survol, sous-menu), trouvés par l'e2e.
- Laissé (mineur) : un clic droit sur un dossier en lecture seule n'ouvre rien mais empêche quand même le menu du navigateur.
- Laissé (hors périmètre, prévu au lot #47) : `IdeasPanel` affiche encore les dossiers d'idées à plat, et le bouton « Ajouter une idée » existe toujours.

## Reste à faire

- Lots #47 (dossiers d'idées, couleur et icône), #48 (bouton « Lieu »), #49 (Explorer la zone).
