# Idée mise en évidence au-dessus des étapes sur la carte

- Date : 2026-11-25
- Type : correction
- Issue : aucune

## Demande

Défaut relevé à la revue de la correction du marqueur décalé
(`2026-11-25-marqueur-selectionne-decale.md`), dont la correction a été demandée par l'utilisateur :
une idée sélectionnée ou survolée restait sous les marqueurs d'étapes voisins.

## Ce qui a été fait

- `TripMap.svelte` : règle `.map-marker.idea.highlighted { z-index: 2 }`.

## Décisions et pourquoi

- **Règle plus spécifique** plutôt que réordonner les règles : l'intention (une idée mise en
  évidence passe devant) se lit dans le sélecteur et ne dépend pas de l'ordre du fichier.

## Bugs et pièges rencontrés

- **Cause racine** : `.map-marker.idea` (`z-index: 0`) était déclarée après
  `.map-marker.highlighted` (`z-index: 2`), à spécificité égale : la règle de l'idée l'emportait.

## Tests et vérifications

- TDD : e2e `step-popup.spec.ts` « clic sur une idée qui a un lieu » complété. Une fois l'idée
  sélectionnée, son marqueur doit avoir un `z-index` plus grand que celui d'un marqueur d'étape.
  Vu en échec (0 au lieu de plus de 1), puis au vert.
- `pnpm lint`, `pnpm typecheck` propres. Tests unitaires : core 242, API 200, web 451.
- E2E : `npx playwright test --workers=2` (build de production compris) : 88 sur 88.

## Revue

- Auto-revue. Revue indépendante non lancée : changement trivial (une règle CSS).

## Reste à faire

- Rien.
