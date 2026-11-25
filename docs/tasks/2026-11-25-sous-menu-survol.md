# Sous-menu du menu contextuel refermé avant d'être atteint à la souris

- Date : 2026-11-25
- Type : correction
- Issue : aucune (signalé par l'utilisateur après la PR #58)

## Demande

Dans le menu contextuel, le survol de « Ajouter à un jour » affiche la liste des jours, mais elle se referme dès que le pointeur se dirige vers elle : impossible d'y choisir un jour à la souris.

## Ce qui a été fait

- `ContextMenu.svelte` : la fermeture du sous-menu quand le pointeur quitte son entrée est différée de 300 ms (`hideSubLater`) ; revenir sur l'entrée ou entrer dans le sous-menu (son descendant) l'annule (`cancelHide` dans `showSub` et `hideSub`). Minuterie effacée à la destruction du menu.

## Bugs et pièges rencontrés

- **Cause racine** : le sous-menu est placé à `left: calc(100% + 4px)` de son entrée (`.sub-wrap`). Entre les deux, le pointeur traverse la marge intérieure du menu, qui n'appartient pas à `.sub-wrap` : `mouseleave` se déclenchait et `hideSub` fermait le sous-menu aussitôt. Le défaut existait depuis #46 pour « Déplacer vers » ; il n'était pas vu parce que les e2e ouvrent les sous-menus au clic, qui les laisse ouverts.
- La fermeture différée couvre aussi le passage en diagonale sur une autre entrée et le sous-menu ouvert à gauche (`flip`).
- Pour tester un survol réel en e2e, déplacer le pointeur pas à pas (`page.mouse.move(x, y, { steps })`) : un `hover()` direct saute la zone fautive.

## Tests et vérifications

- `ContextMenu.test.ts` : « le sous-menu reste ouvert le temps d'y aller » (minuteries simulées : sortie puis retour, puis départ définitif), vu en échec avant le correctif.
- `e2e/search.spec.ts` : l'ajout à J2 passe par le survol puis un déplacement du pointeur en 25 pas jusqu'à « J2 ». Vu en échec avec l'ancien `ContextMenu.svelte` (délai dépassé sur le clic de J2), vert avec le correctif.
- `pnpm lint`, `svelte-check` propres ; unitaires web 467 ; e2e `search`, `context-menu`, `poi` : 21 sur 21.

## Revue

- Auto-revue seulement (changement de quelques lignes, sans sécurité ni performance en jeu).

## Reste à faire

- Rien.
