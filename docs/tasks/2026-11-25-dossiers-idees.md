# Dossiers dans les idées, avec couleur et icône ; idées plus compactes

- Date : 2026-11-25
- Type : fonctionnalité
- Issue : #47 (lot 2/4 de l'harmonisation des lieux ; lot 1 : #46)

## Demande

- Idées plus compactes.
- Dossiers dans les idées : ajout, modification, suppression, glisser-déposer des lieux dedans.
- Un dossier a une couleur et une icône, choisies comme dans la fenêtre d'un lieu.
- Retrait de « Ajouter une idée ».
- Retrait de « Nouveau dossier » sous les lieux du jour, remplacé par un bouton icône dans l'en-tête du jour, près de la barre du temps.

## Ce qui a été fait

- **Migration** `0010_group_style.sql` : `steps.icon` (type d'étape, NULL : icône dossier) et `steps.color` (0 à 7, NULL : accent).
- **Core** (`step/schemas.ts`) :
  - `Step.icon` et `Step.color` ;
  - `StepCreate` les accepte pour un dossier, les refuse sur une étape, et met `null` par défaut ;
  - `StepPatch` les accepte (`null` remet la valeur par défaut).
- **API** :
  - `db/steps.ts` lit les colonnes ;
  - la création les écrit ;
  - `plans.ts` les modifie (`STEP_COLUMNS`) et répond `400 invalid` sur une étape.
- `GroupDialog.svelte` réécrit : création et modification. Nom, icône (`.cat-grid` : « Dossier » puis les 17 types), couleur (`.swatches` : « Automatique » puis les 8 couleurs nommées des trajets). Il renvoie `GroupValues`.
- `StepEditor` ne gère plus les dossiers : la page ouvre `GroupDialog` pour un dossier, quel que soit le chemin (menu contextuel, éditeur).
- `GroupCard.svelte` :
  - couleur et icône du dossier (`--gc`, `data-icon`) ;
  - le clic sur le titre le replie ou le déplie (il n'ouvre plus l'éditeur) ;
  - variante `dense`.
- `MetroLine.svelte` : même couleur, même icône et même repli au clic pour les dossiers.
- `IdeasPanel.svelte` :
  - arbre racines et dossiers (`GroupCard` dense, dépôt avec `dayId: null` et `parentId`) ;
  - variante `dense` des cartes et des zones de dépôt (4 px de haut, fixe) ;
  - bouton icône « Nouveau dossier d’idées » à la place de « Ajouter une idée ».
- `StepCard` et `DropZone` : variante `dense`.
- Page voyage :
  - `ideas` comprend les étapes rangées dans un dossier d'idées ;
  - bouton icône « Nouveau dossier » dans `dayHead` (dans les trois affichages, par colonne en plein écran) ;
  - « Nouveau dossier » retiré de la barre d'ajout ;
  - `addGroup` (jour du bouton, ou idées) et `saveGroup` (champs changés, par `runCommand`, donc annulable).
- `lib/schedule/history.ts` : `icon` et `color` dans les champs annulables.

## Décisions et pourquoi

- **Icône et couleur séparées** (choix de l'utilisateur au plan) : une icône prise parmi les types, une couleur parmi la palette des trajets, déjà nommée et déclinée par thème.
- **Colonnes dédiées** plutôt que `type` pour l'icône : le type d'une étape porte d'autres règles (durée par défaut, refus sur un dossier dans `plans.ts`). Mêler les deux aurait été risqué.
- **Noms distincts des boutons** : « Nouveau dossier » (jour) et « Nouveau dossier d’idées » (idées), pour les lecteurs d'écran et les e2e.
- **Clic sur le titre d'un dossier : repli.** On le modifie par son menu contextuel, comme les autres lieux depuis le lot 1.
- **« Modifier le dossier » sans notes ni jour** : le jour se change par « Déplacer vers » ou le glisser-déposer. Les notes de dossier, qui n'étaient visibles que dans l'ancien éditeur, ne sont plus modifiables (limite notée dans la spécification).

## Bugs et pièges rencontrés

- **Annulation d'un changement de couleur** : `inverseOps` ne connaissait pas `icon` ni `color`. L'inverse aurait été un lot vide, refusé par l'API (« Aucune modification »). Corrigé et couvert (test unitaire vu en échec, puis Ctrl+Z et Ctrl+Y en e2e). À retenir : un nouveau champ modifiable d'étape doit entrer dans `STEP_FIELDS` de `history.ts`.
- Les fabriques d'étapes des tests (core et web) doivent recevoir les nouveaux champs, sinon le typecheck échoue (pas les tests).
- E2E qui ajoutaient une idée par « Ajouter une idée » : ils passent par la recherche de la carte sur « Tout le voyage » (fenêtre « Ajouter une idée »), en attendant le bouton « Lieu » du lot 3.

## Tests et vérifications

- TDD, vus en échec avant le code :
  - core `schemas.test.ts` (3 cas) ;
  - API `steps.test.ts` (icône et couleur d'un dossier, refus sur une étape ; le dossier d'idées passait déjà, gardé comme garde-fou) ;
  - `GroupDialog.test.ts` (3 cas), `GroupCard.test.ts` (4 cas), `IdeasPanel.test.ts` (dossiers, bouton icône, lecture seule) ;
  - `history.test.ts` (inverse d'icône et de couleur).
- E2E `e2e/folders.spec.ts` :
  - dossier d'idées avec icône Musée et couleur Rose, idée glissée dedans ;
  - « Modifier » vers Vert, Ctrl+Z, Ctrl+Y ;
  - « Déplacer vers J1 » avec son idée ;
  - « Supprimer » en gardant les étapes ;
  - bouton dossier de l'en-tête du jour.
- E2E adaptés : `steps.spec.ts`, `step-popup.spec.ts`, `context-menu.spec.ts`.
- `pnpm lint` et `pnpm typecheck` propres.
- Tests unitaires : core 242, API 200, web 429.
  - Pendant `pnpm test` enchaîné juste après l'e2e, trois tests web ont dépassé 5 s (machine chargée), dont deux non touchés ; relancés seuls, tous verts.
  - `GroupDialog.test.ts` (18 icônes, 9 pastilles) est le plus lent : à surveiller.
- E2E complets `--workers=2` (ports 8795 et 8805) : 81 sur 81. Après le correctif d'annulation : `folders.spec.ts` 2 sur 2.
- Captures à 1280 px : fenêtre « Nouveau dossier » et idées compactes avec un dossier rose à icône musée.
  - La capture a montré que la pastille « Automatique » se confondait avec la sarcelle : elle porte maintenant l'icône étincelle, comme dans la fenêtre d'un trajet.
- Non vérifié : migration 0010 en production (à appliquer avant le déploiement).

## Revue

- Corrigé : `inverseOps` sans `icon` ni `color` (annulation impossible, voir les pièges).
- Corrigé : la pastille « Automatique » se confondait avec la sarcelle.
- Corrigé (mineur) : `IdeasPanel` recréait une `Map` vide à chaque rendu.
- Vérifié :
  - copies hors ligne anciennes sans `icon` ni `color` : `?? null` ou test de `undefined` dans `GroupCard`, `MetroLine`, `GroupDialog` et `saveGroup` ;
  - dossier déplacé vers un jour avec ses idées (règle API existante, e2e) ;
  - lecture seule : pas de bouton de dossier, ni dans le jour ni dans les idées.
- Laissé : notes de dossier non modifiables (limite notée dans la spécification).

## Reste à faire

- Lots #48 (bouton « Lieu ») et #49 (Explorer la zone).
- Avant de déployer : appliquer la migration 0010 en production (`pnpm --filter @mytrips/api db:migrate:remote`).
