# Fenêtres de lieu et de trajet façon maquette, couleurs des trajets

- Date : 2026-11-24
- Type : fonctionnalité (front, API, base)
- Issue : aucune (demande de l'utilisateur)

## Demande

Reprendre la maquette de référence (`C:\MyDatas\Temp\game2`) pour les fenêtres de création et de
modification des trajets et des lieux : boutons de mode de transport et design de ces fenêtres ;
trajets de couleurs différentes, choisies dans l'édition comme les couleurs des jours (couches) de
la maquette. Réponses de l'utilisateur : palette de la maquette, automatique puis choix ; latitude /
longitude et nouvelle position en cliquant sur la carte.

## Ce qui a été fait

- **Couleur des trajets** :
  - `core/leg/colors.ts` : `LEG_COLOR_COUNT` (8), `legColorVar`, `dayLegColors` (automatique : la
    couleur qui suit le trajet précédent) ; `color` dans `LegCreate`, `LegPatch` (nullable), `Leg` ;
  - migration `0009_leg_color.sql` (`legs.color`, 0 à 7 ou NULL), `db/legs.ts`, `routes/legs.ts`
    (POST et PATCH, sans nouveau calcul) ;
  - thèmes : `--leg-1` à `--leg-8` (couleurs de `LAYER_COLORS`) ;
  - web : `dayPairs` donne `color` et `autoColor` ; `dayLegLines`, `LegTile`, `MetroLeg`,
    `legPopupContent` utilisent la couleur du trajet ; `newLegAutoColor` pour un trajet saisi à la
    main ; `data-leg-colors` sur la carte (e2e).
- **Fenêtres** :
  - `Modal` : `subtitle`, `hidden`, focus sur `data-autofocus`, Échap déjà traité ignoré ;
  - `controls.css` : `.field.ref`, `.field-row`, `.seg`, `.cat-grid`, `.swatches` (boutons radio
    masqués), `.field textarea` ;
  - `LegEditor` : modes en `.seg`, couleur en `.swatches` (« Automatique » puis 8 couleurs),
    « Ajouter le trajet » pour un nouveau trajet, pied Supprimer · Recalculer · Annuler · Enregistrer ;
  - `StepEditor` : sous-titre, « Nom du lieu », catégorie en `.cat-grid`, Latitude / Longitude,
    « Choisir sur la carte », heure fixe à côté de la durée, pied comme la maquette ;
  - `AddPlaceDialog` : sous-titre, catégorie en `.cat-grid` (Automatique et 7 types rapides),
    focus sur la recherche, « Annuler » ;
  - `TripMap` : prop `placing` (bandeau, curseur en croix, clic → point, Échap ou Annuler) ; page :
    `pickOnMap` (promesse), adresse du nouveau point par géocodage inverse dans `saveStep`.

## Décisions et pourquoi

- **Couleur stockée en rang de palette** (0 à 7), pas en code couleur : chaque thème la décline par
  ses variables (règle « pas de couleur en dur »).
- **Automatique = couleur suivante du trajet précédent** (et non le rang du trajet) : deux trajets
  consécutifs ne se ressemblent jamais, même après une couleur choisie.
- **Pastille « Automatique »** en plus des 8 couleurs de la maquette : sans elle, une couleur choisie
  ne pourrait plus revenir en automatique.
- **Boutons radio natifs masqués** plutôt que des boutons à `aria-pressed` : flèches du clavier,
  groupe nommé (`fieldset` / `legend`) et lecture correcte sans code.
- **Modes en colonne** (icône au-dessus du libellé) : 7 modes ne tiennent pas en ligne dans une
  fenêtre de 480 px (la maquette n'en a que 3).
- **Titre « Modifier l'étape » gardé** (vocabulaire de l'appli et des e2e) ; sous-titre repris de la
  maquette (« Mettez à jour les informations de cette étape. »).
- **Choix sur la carte par promesse** (`onPickOnMap`) : l'éditeur reste monté (saisies en cours
  gardées), seulement masqué.
- **Adresse recalculée** au déplacement : l'ancienne adresse serait fausse.

## Bugs et pièges rencontrés

- Échap pendant le choix sur la carte fermait aussi l'éditeur : entre deux écouteurs d'un événement
  réel, la microtâche qui réaffiche la fenêtre s'exécute, et `Modal` voyait une fenêtre visible.
  Correctif : `preventDefault()` côté carte, `Modal` ignore un Échap déjà traité (e2e et test
  unitaire). Noté dans `CLAUDE.md`.
- En e2e, un bouton radio masqué ne se clique pas directement (le libellé intercepte) : cliquer le
  libellé. Noté dans `CLAUDE.md`.
- Revue : un trajet d'un ancien cache hors ligne (sans `color`) n'avait aucune pastille cochée ;
  `start.color ?? null`.

## Tests et vérifications

- TDD, vus en échec avant le code : `colors.test.ts`, `schemas.test.ts` (couleur), API
  `legs.test.ts` (couleur automatique, choisie, remise en automatique, à la création, 400 hors
  palette), `Modal.test.ts` (sous-titre, masquée, Échap traité), `LegEditor.test.ts`,
  `StepEditor.test.ts`, `AddPlaceDialog.test.ts` (nouveau), `legs.test.ts` (couleurs des paires et
  des tracés, `newLegAutoColor`), `popups.test.ts`, `LegTile.test.ts`, `MetroLeg.test.ts`.
- E2E : `legs.spec.ts` (modes en boutons, couleurs automatiques `--leg-1 --leg-2` sur tuiles et
  carte, Vélo et Rose choisis, popup en Rose), `steps.spec.ts` (latitude / longitude, choix sur la
  carte abandonné par Échap puis fait, position et adresse enregistrées), adaptations de
  `poi.spec.ts` et `steps.spec.ts` (catégorie) et du « Nouveau trajet ». Écrits après le code des
  composants : vus en échec seulement pour `data-leg-colors` et pour le bug d'Échap, qu'ils ont
  révélé.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` propres ; `pnpm test` : core 239, API 197, web 370 ;
  `pnpm test:e2e --workers=2` : 70 sur 70. Captures (1280 px) des fenêtres du trajet et du lieu,
  des couleurs automatiques et du bandeau du choix sur la carte (qui masquait la recherche de la
  carte : corrigé).

## Revue

- Corrigés : pastille automatique d'un ancien cache ; marqueurs qui bloquaient le clic pendant le
  choix (`pointer-events: none`) ; choix abandonné si l'éditeur disparaît.
- Laissés : un trajet recréé sur la même paire repart en automatique ; la fenêtre du séjour
  (`StayDialog`) n'a pas été reprise (hors demande).

## Reste à faire

- Appliquer la migration `0009` en production avant le déploiement.
