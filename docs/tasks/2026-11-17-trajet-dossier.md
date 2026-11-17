# Trajet après un dossier : hors du dossier

- Date : 2026-11-17
- Type : correction d'affichage (front)
- Issue : aucune (retour de l'utilisateur)

## Demande

Un dossier se lit comme une étape. Le trajet entre le dossier et l'étape suivante doit donc
s'afficher hors du dossier, entre les deux, comme entre deux étapes.

## Ce qui a été fait

- `GroupCard.svelte` : la tuile de trajet n'est plus rendue après la dernière étape du dossier.
- `Timeline.svelte` : après un dossier, rendu du trajet qui part de sa dernière étape (même
  paire qu'avant, `fromKey` = dernière étape du dossier).

## Décisions et pourquoi

- Seul l'affichage change : la paire de trajet reste « dernière étape du dossier → étape
  suivante » (calcul des horaires, `dayPairs` et API inchangés).
- Dossier replié : ce trajet reste visible, puisqu'il est hors du dossier.

## Tests et vérifications

- TDD : `Timeline.test.ts` (« le trajet qui suit un dossier est hors du dossier »), vu en échec
  puis au vert.
- Mesuré dans le build servi par `wrangler dev` : plus qu'un trajet dans le dossier (entre ses
  deux étapes), la tuile suivante est sous le dossier, à 16 px.
