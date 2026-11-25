# Marqueur sélectionné décalé de son lieu

- Date : 2026-11-25
- Type : correction
- Issue : aucune

## Demande

Au clic sur un lieu d'un jour ou des idées, la popup s'ouvre au bon endroit, mais le marqueur
(avec son icône) est nettement décalé.

## Ce qui a été fait

- `TripMap.svelte` : chaque marqueur (`button.map-marker`, positionné par MapLibre) contient
  désormais un `span.pin` qui porte tout le visuel (pastille, bordure, couleur, numéro ou icône SVG
  d'une idée) et la mise en évidence (`scale: 1.25`). L'élément extérieur garde les classes
  (`highlighted`, `faded`, `idea`), le `z-index`, les écouteurs, `title`, `aria-label` et
  `data-icon` ; il n'a plus ni style visuel, ni `scale`, ni transition.
- `CLAUDE.md` : le piège « Marqueurs HTML de MapLibre » recommandait `scale` sur l'élément du
  marqueur ; il dit maintenant de le mettre sur un élément intérieur.

## Décisions et pourquoi

- **Élément intérieur plutôt que changer la taille** : garde l'effet visuel existant (agrandi par
  le bas, transition) sans toucher à l'élément positionné par MapLibre.

## Bugs et pièges rencontrés

- **Cause racine** : les propriétés CSS individuelles (`translate`, `rotate`, `scale`) se
  composent _avant_ `transform` dans la matrice, donc s'appliquent après lui aux points :
  `scale: 1.25` multipliait aussi le `translate(x, y)` que MapLibre pose en ligne. Le marqueur mis
  en évidence s'éloignait du coin haut gauche de la carte de 25 % de sa position (142 px mesurés en
  e2e après le zoom sur le lieu). Le bug existait depuis #46 ; il se voyait au clic, où la
  sélection garde le marqueur en évidence, et la popup, placée indépendamment, restait juste.
- Le piège de `CLAUDE.md` affirmait à tort que `scale` « se combine avec la position ».

## Tests et vérifications

- TDD : e2e `step-popup.spec.ts` « clic sur un lieu : son marqueur, mis en évidence, reste à sa
  position (sous la popup) ». Il compare le bas du marqueur à la projection du lieu
  (`__mapProjectForTests`, ratio de la taille d'affichage). Vu en échec : écart de 142 px ;
  au vert après le correctif.
- `pnpm lint`, `pnpm typecheck` propres. Tests unitaires : core 242, API 200, web 451.
- E2E : `npx playwright test --workers=2` (build de production compris) : 88 sur 88, après les
  corrections de la revue.
- Le test de survol de `context-menu.spec.ts` a échoué une fois (élément introuvable sous charge,
  deux fichiers en parallèle), puis est passé seul et quatre fois de suite (`--repeat-each=4`).

## Revue

Revue indépendante (sous-agent relecteur), points vérifiés puis corrigés :

- **Bloquant** : `e2e/poi.spec.ts` « les marqueurs d'étapes suivent la carte sans animer leur
  position » lit `transitionProperty` de `.map-marker`. Sans `transition` déclarée, la valeur
  calculée est `all` (durée 0 s) et le test échouait. `transition: none` explicite sur
  `.map-marker`.
- **Mineur** : l'anneau de focus clavier (`:focus-visible`) se dessinait en rectangle autour du
  bouton. Il est maintenant sur `.pin`, dont il suit la forme et l'agrandissement.
- **Mineur** : l'e2e mesurait le bouton et acceptait le premier relevé sous 3 px (faux succès
  possible pendant le zoom). Il mesure désormais `.pin` et garde le pire de deux relevés espacés
  de 250 ms.
- Laissé (préexistant, hors périmètre) : une idée mise en évidence garde `z-index: 0`, la règle
  `.map-marker.idea` venant après `.map-marker.highlighted` à spécificité égale.

## Reste à faire

- Rien.
