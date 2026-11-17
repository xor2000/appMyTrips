# Temps libre plus visible dans la timeline

- Date : 2026-11-17
- Type : correction d'affichage (front)
- Issue : aucune (retour de l'utilisateur : « on ne voit pas assez l'indication 7 h libre »)

## Ce qui a été fait

- `StepCard.svelte` : le temps libre avant une étape passe d'un petit texte vert (11 px, mono) à
  une pastille centrée sur la ligne de la timeline : fond `--ok-soft`, contour pointillé `--ok`,
  icône sablier (lucide `hourglass`), texte « 1 h 55 de temps libre » en 13 px gras.

## Tests et vérifications

- TDD : `StepCard.test.ts` (texte « 1 h 15 de temps libre » et icône), vu en échec puis au vert.
- Contrôlé dans le build servi par `wrangler dev` : pastille centrée sur la ligne (écart 0 px).
- Suites : voir le compte rendu de la session.
