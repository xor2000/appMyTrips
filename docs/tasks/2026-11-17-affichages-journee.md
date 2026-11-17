# Trois affichages de la journée : liste, ligne de métro, plein écran

- Date : 2026-11-17
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur, après les pistes en artifact « MyTrips · pistes de timeline »)

## Demande

Laisser l'utilisateur choisir l'affichage de la journée : l'actuel (liste et carte), la ligne de
métro ou le plein écran. Les trois doivent être maintenus. Choix de l'utilisateur : réglage sur
« Mon compte » plus sélecteur rapide sur la page voyage, **parité complète** d'édition (glisser-
déposer compris en métro), plein écran avec tous les jours en colonnes.

## Ce qui a été fait

- `lib/layout.ts` : liste des affichages, lecture et mémorisation (`mytrips.layout`).
- `LayoutPicker` (« Mon compte », section « Apparence ») et `LayoutSwitch` (en-tête du voyage).
- `lib/trips/dayViews.ts` : modèle de chaque jour (éléments, paires de trajets, horaires,
  numéros), utilisé par la page à la place des calculs limités au jour sélectionné.
- `steps/MetroLine.svelte` et `steps/MetroStop.svelte` : ligne de métro (stations, dossiers
  encadrés, séjours, tuiles de trajet de la liste, temps libre, conflits, plus tôt / plus tard,
  suppression, glisser-déposer). `DropZone` a une variante verticale (largeur fixe).
- Page voyage : en-tête du jour, boutons d'ajout, liste des jours, idées, carte et exploration
  en snippets partagés ; trois dispositions (`list`, `metro`, `board`).

## Décisions et pourquoi

- **Un socle, trois présentations** : mêmes données (`buildDayViews`), mêmes actions (`move`,
  `drop`, `addLeg`, fenêtres d'édition) et mêmes composants (`LegTile`, `DropZone`, `Timeline`
  dans les colonnes du plein écran) : une correction profite aux trois affichages.
- **Ligne alignée par hauteurs fixes** : la ligne est un fond du conteneur à une hauteur donnée
  (`--metro-top` + moitié de `--metro-node`) ; stations, tuiles et dossiers respectent ces
  hauteurs. Le nom d'un dossier est en pied de cadre pour ne pas décaler la ligne.
- **Ajouts en plein écran** : chaque colonne fixe le jour sélectionné avant d'ouvrir la fenêtre
  d'ajout (les fonctions d'ajout existantes visent ce jour).
- Plus tôt / plus tard en métro (au lieu de monter / descendre), même action `move`.

## Tests et vérifications

- TDD, vus en échec puis au vert : `layout.test.ts`, `LayoutPicker.test.ts`,
  `LayoutSwitch.test.ts`, `trips/dayViews.test.ts`, `steps/MetroLine.test.ts`.
- E2e `layouts.spec.ts` (choix sur Mon compte, bascule et mémorisation ; métro : ajout, trajet,
  plus tard, glisser, édition ; plein écran : ajout par colonne, glisser d'un jour à l'autre),
  écrit après l'intégration dans la page : passé du premier coup, pas vu en échec.
- Contrôle visuel dans le build servi par `wrangler dev` : ligne au centre des stations (écart
  2 px), dossier encadré, colonnes du plein écran.
- `pnpm lint`, `pnpm typecheck` propres ; `pnpm test` : core 234, API 186, web 280 ; `pnpm test:e2e` : 47/47 (puis `layouts.spec.ts` relancé après la correction du lint : 4/4).

## Reste à faire

- Ligne de métro sur téléphone (pensée pour un écran large) et vue « Tout le voyage » en métro
  (liste des jours, comme l'affichage liste).

## Retour après déploiement : trajets trop larges en métro

- Les tuiles de trajet de la liste (`LegTile`, avec ses 7 boutons de mode) prenaient environ
  250 px entre deux stations. La ligne de métro utilise désormais `legs/MetroLeg.svelte` :
  84 px, posé sur la ligne comme une station (durée au-dessus, rond du mode sur la ligne, mode,
  distance et origine dessous), clic pour modifier ; sans trajet, un « + » se déplie pour
  choisir le mode (Échap le replie), avec la reprise d'un trajet saisi à la main. Mêmes actions
  (`addLeg`, `editingLegId`) via le snippet `metroLegAfter` de la page.
- TDD : `MetroLeg.test.ts`, vu en échec puis au vert ; e2e `layouts.spec.ts` (« + » à déplier,
  largeur ≤ 150 px) mis à jour avant l'implémentation, mais lancé seulement après. Mesuré : trajets de 84 px centrés sur la ligne (79 px, comme les stations),
  ligne de 2426 à 1530 px pour la journée test.
- Lint, tests web (285), e2e `layouts` et `legs` (8/8) au vert.
