# Explorer la zone : bouton « Tous » et résultats groupés par catégorie

- Date : 2026-11-25
- Type : fonctionnalité (front)
- Issue : #49 (lot 4/4 de l'harmonisation des lieux ; lots précédents #46, #47, #48)

## Demande

Renommer le bouton « Explorer » en « Explorer la zone ». Pendant l'exploration, ajouter un bouton « Tous » qui sélectionne d'un coup tous les filtres. Trier les résultats par catégorie, chacune sous un petit titre avec icône et filet de séparation.

## Ce qui a été fait

- `TripMap.svelte` : libellé « Explorer la zone ».
- `lib/poi/explore.ts` : `groupPoisByCategory`, qui groupe les lieux dans l'ordre de `POI_CATEGORIES`, sans groupe vide et en gardant l'ordre de classement dans chaque groupe.
- `ExplorePanel.svelte` :
  - pastille « Tous » en tête (`aria-pressed`) : coche toutes les catégories, ou les décoche toutes si elles le sont déjà (prop `onSetCategories`) ;
  - résultats dans un groupe « Lieux trouvés » (`role="group"`), un bloc par catégorie ;
  - chaque bloc a un titre `h3` (icône du type, libellé, nombre avec « lieu » ou « lieux » pour les lecteurs d'écran) avec un filet, puis sa propre liste nommée par ce titre (`aria-labelledby`).
- Page voyage : `setCategories(list)` (une seule recherche, ou remise à zéro) et `clearPois` (remise à zéro commune avec `toggleCategory`).
- `docs/specification.md` : §1 (découverte) et §2 (pilule d'outils).

## Décisions et pourquoi

- **« Tous » en une seule recherche** : cocher les 9 catégories une à une lancerait 9 recherches successives vers Overpass ou son cache.
- **« Tous » de nouveau décoche tout** : il sert de bascule, son état est lu par `aria-pressed`.
- **Une liste par catégorie** plutôt que des titres dans une liste unique : un titre ne peut pas être un enfant direct d'une liste (règle ARIA des enfants requis). La liste unique « Lieux trouvés » devient un groupe ; les tests la cherchent maintenant par `getByRole('group', { name: 'Lieux trouvés' })`.

## Bugs et pièges rencontrés

- Une première version mettait les titres dans la liste en `<li role="presentation">`. Chromium comptait encore ces éléments comme `listitem` : les e2e de l'explorateur voyaient un lieu de trop. Corrigé par la structure en blocs (point relevé aussi par la revue indépendante).
- Prettier supprime une espace placée en début de texte dans un `<span>` : l'unité lue par les lecteurs d'écran devenait « 1lieu ». L'espace est passée dans l'expression (`' lieux'`).

## Tests et vérifications

- TDD, vus en échec avant le code :
  - `explore.test.ts` (3 cas : ordre des groupes, ordre interne, aucun lieu) ;
  - `ExplorePanel.test.ts` (« Tous » coche tout, « Tous » décoche tout, groupes avec titre, icône et nombre ; puis une liste par catégorie, sans titre directement dans une liste).
- E2E `poi.spec.ts` : bouton « Explorer la zone » ; « Tous » coche les 9 catégories en une seule requête `/api/poi` ; titres dans l'ordre (Cafés avant Musées) ; « Tous » de nouveau vide les résultats.
- `pnpm lint` et `pnpm typecheck` propres. Tests unitaires : core 242, API 200, web 452 (avant la restructuration en blocs ; tests de l'explorateur relancés ensuite : 13 sur 13 pour le panneau, 22 pour l'ensemble `poi`).
- E2E complets `--workers=2` sur la première version : 81 sur 87. Les 6 échecs, tous dans `poi.spec.ts`, venaient des titres en `<li role="presentation">`, comptés comme `listitem`.
- Après la restructuration : `poi.spec.ts` 10 sur 11. L'échec (« trop loin : la découverte invite à zoomer », animation de cadrage, instabilité déjà connue) n'a pas de lien avec le changement : il passait dans la passe complète précédente, et 3 relances sur 3 sont vertes.
- Non relancé après la restructuration : le reste de la suite e2e (fichiers non touchés par ce changement, verts dans la passe complète).

## Revue

- Revue indépendante (relecteur Opus) :
  - **important**, corrigé : titres dans la liste (règle ARIA), voir plus haut ;
  - mineurs, corrigés : nombre sans unité pour les lecteurs d'écran ; espacement doublé avant les titres ; remise à zéro dupliquée (`clearPois`) ; nom de test inexact.
- Vérifié sans problème : pas de recherche en double ; réponse ancienne ignorée (`poiRequest`) ; zoom trop faible ; aucune requête automatique au déplacement ; les 9 catégories passent côté API.

## Reste à faire

- Rien pour ce lot ; l'harmonisation des lieux (#46 à #49) est terminée.
