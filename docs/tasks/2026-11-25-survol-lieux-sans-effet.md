# Plus d'action au survol des lieux et séjours de la liste

- Date : 2026-11-25
- Type : autre (comportement du front)
- Issue : aucune

## Demande

Enlever les actions au survol des lieux dans les jours et les idées. Depuis #46, la seule action
restante était la mise en évidence : survoler un lieu posait un liseré sur sa carte et grossissait
son marqueur. Choix de l'utilisateur : retirer aussi le survol des séjours ; garder le survol des
marqueurs (sens carte → liste) et celui des trajets.

## Ce qui a été fait

- `StepCard`, `MetroStop`, `StayCard` et la ligne de séjour de `MetroLine` : écouteurs
  `onmouseenter` / `onmouseleave` retirés.
- Prop `onHover` supprimée de ces composants et de ceux qui ne faisaient que la transmettre
  (`GroupCard`, `Timeline`, `IdeasPanel`, `MetroLine`), ainsi que des quatre appels de la page
  voyage (idées, timeline du jour, ligne de métro, plein écran).
- Inchangés : `onHover` de `TripMap` (survol d'un marqueur), de `LegTile` et `MetroLeg` (trajets),
  de `ExplorePanel` (découverte). L'état `highlighted` de la page sert toujours à ces survols.
- `docs/specification.md` : §1 (règles communes des lieux) et décision en §8.

## Décisions et pourquoi

- **Sens carte → liste conservé** : seule la liste était visée par la demande ; survoler un marqueur
  reste le moyen de retrouver le lieu dans la colonne.
- **Trajets non touchés** : ce ne sont pas des lieux ; leur survol met en évidence le tracé.

## Bugs et pièges rencontrés

- Aucun. Rappel : un `cd` dans une commande Bash change le dossier de travail de la session pour
  les commandes suivantes ; préférer les chemins absolus.

## Tests et vérifications

- TDD : l'e2e `context-menu.spec.ts` « survol d'un lieu ou d'un séjour (jour, idées, métro) : rien
  n'est mis en évidence » remplace l'ancien test du survol. Il vérifie d'abord que le survol d'un
  marqueur met toujours le lieu en évidence dans la liste, puis l'absence de mise en évidence pour
  un lieu d'un jour, un séjour, une idée et une station de métro. Vu en échec avant le code (la
  carte d'Orsay gardait la classe `highlighted` au survol).
- Test unitaire « signale le survol » de `StepCard.test.ts` supprimé ; `onHover` retiré des props
  des tests de `GroupCard`, `IdeasPanel`, `MetroLine`, `StepCard` et `Timeline`.
- `pnpm lint`, `pnpm typecheck` propres. Tests unitaires : core 242, API 200, web 451, tous verts.
- E2E : `npx playwright test --workers=2` (build de production compris) : 87 sur 87.

## Revue

- Auto-revue du diff : retrait pur, aucun appel restant à `onHover` côté lieux, aucune logique
  ajoutée. Revue indépendante non lancée : changement trivial (suppression de props et
  d'écouteurs).

## Reste à faire

- Rien.
