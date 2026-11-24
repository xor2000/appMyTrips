# Flèches de défilement des onglets de jours

- Date : 2026-11-24
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur)

## Demande

Quand le séjour compte trop de jours, une barre de défilement apparaît sous les onglets de l'en-tête.
La supprimer et afficher une flèche avant le premier jour et après le dernier pour avancer dans les
jours.

## Ce qui a été fait

- `apps/web/src/lib/components/DayTabs.svelte` :
  - « Tout le voyage » reste fixe ; les onglets des jours sont dans un conteneur `.scroller` qui
    défile horizontalement, barre masquée (`scrollbar-width: none` et `::-webkit-scrollbar`) ;
  - flèches « Jours précédents » (entre « Tout le voyage » et J1) et « Jours suivants » (après le
    dernier jour), affichées seulement quand les jours débordent, désactivées en bout de liste ;
    un clic avance ou recule de 80 % de la largeur visible (défilement doux) ;
  - mesure (`measure()`) au montage, quand le nombre de jours change, au défilement et au
    redimensionnement (`ResizeObserver`) ;
  - molette verticale sur les jours : défilement horizontal (écouteur non passif) ;
  - une étape glissée sur une flèche fait défiler (16 px par `dragover`), pour atteindre un onglet
    de jour masqué : sans barre, c'était sinon impossible pendant un glisser.
- `docs/specification.md` : en-tête (onglets des jours).

## Décisions et pourquoi

- **Flèches hors de l'arbre d'accessibilité** (`aria-hidden`, `tabindex="-1"`) : un `tablist` ne doit
  contenir que des onglets ; au clavier, l'onglet qui reçoit le focus défile de lui-même. Les e2e
  les trouvent par leur `title`.
- **Flèches désactivées plutôt que masquées en bout de liste** : leur apparition ou disparition
  décalerait les onglets sous le curseur.
- **« Tout le voyage » hors du défilement** : la flèche précédente se place bien « avant le premier
  jour », et la vue d'ensemble reste toujours accessible.
- Pas de défilement automatique vers le jour sélectionné : non demandé (le jour choisi l'a été par
  un clic, donc il est visible).

## Bugs et pièges rencontrés

- Chromium headless de Playwright masque les barres de défilement (`--hide-scrollbars`) : l'e2e
  vérifie donc `getComputedStyle(...).scrollbarWidth === 'none'` plutôt qu'une différence de hauteur.

## Tests et vérifications

- TDD, vus en échec avant le code : `DayTabs.test.ts` (aucune flèche si tout tient ; flèches de part
  et d'autre des jours, précédente désactivée au début ; clic suivant puis précédent ; suivante
  désactivée au bout ; molette verticale ; étape glissée sur une flèche), largeurs et défilement
  simulés sur le prototype (jsdom ne fait pas de mise en page).
- E2E `trips.spec.ts` : voyage de 45 jours (barre masquée, position des flèches, J45 hors de vue
  puis visible après les clics, suivante désactivée au bout, retour, choix de J45) ; voyage de
  3 jours sans flèche.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` propres ; `pnpm test` : core 239, API 197, web 376.
- `pnpm test:e2e --workers=2` : 72 sur 72. Captures de l'en-tête (1280 px) au début et à la fin
  d'un voyage de 45 jours vérifiées.

## Revue

- Fonction de défilement renommée `scrollPage` (le nom `page` prêtait à confusion avec l'état de
  page de SvelteKit).
- Molette en mode « lignes » (Firefox, `deltaMode` 1) : delta converti en pixels (16 px par
  ligne), sinon le défilement était imperceptible.

## Reste à faire

- Rien.
