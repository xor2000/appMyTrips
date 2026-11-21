# Vue satellite sur la carte

- Date : 2026-11-22
- Type : fonctionnalité
- Issue : aucune

## Demande

Ajouter une vue satellite à la carte. Choix de l'utilisateur : imagerie Esri World Imagery, en vue
hybride (routes et libellés par-dessus l'image).

## Ce qui a été fait

- `apps/web/src/lib/map/styles.ts` : fond `satellite` (`MapStyleId`), source raster Esri
  (`server.arcgisonline.com/.../World_Imagery/MapServer/tile/{z}/{y}/{x}`, zoom 19 au plus,
  attribution) ; `toHybrid(style)` construit la vue hybride à partir du style Liberty ;
  `transformFor(id)` donne la transformation de style de chaque fond (`guardMissingNumbers`, plus
  `toHybrid` pour le satellite) ; `styleFor('satellite')` renvoie l'URL de Liberty.
- `apps/web/src/lib/components/TripMap.svelte` : bouton « Satellite » dans le groupe « Fond de
  carte » ; `transformStyle: transformFor(styleId)` à la création et
  `setStyle(…, { diff: false, transformStyle: transformFor(id) })` au changement de fond.
- Carte étroite (≤ 520 px, requête de conteneur sur `.map-wrap`) : le champ de recherche passe sous
  la pilule d'outils.
- `apps/web/vite.config.ts` : imagerie Esri en `CacheFirst` (`satellite-tiles`, 5 000 tuiles,
  60 jours).

## Décisions et pourquoi

- **Hybride par transformation de Liberty** plutôt qu'un second style : sprite, polices et tuiles
  vectorielles déjà en cache pour « Plan » (et préparées hors ligne) sont réutilisés. Gardés :
  libellés (`symbol`), routes (`transportation`, sans tunnels, contours ni hachures) et frontières.
  Routes à 60 % d'opacité ; libellés en blanc sur halo sombre, sauf le texte des panneaux de route
  (blanc sur panneau blanc sinon).
- **`diff: false`** : MapLibre tente par défaut un diff entre l'ancien et le nouveau style. Plan et
  satellite partagent sprite et polices, le diff réussit, supprime les sources ajoutées par l'appli
  (tracés, lieux) et **n'émet pas `style.load`**, l'événement qui les remet. Le rechargement complet
  garantit `style.load`.
- `transformStyle` passé explicitement à chaque `setStyle`, au lieu de compter sur celui de la
  création de la carte.
- Recherche sous la pilule sur carte étroite : le chevauchement existait déjà à 375 px (~35 px) ;
  le bouton supplémentaire le portait à ~100 px.

## Bugs et pièges rencontrés

- `setStyle` avec diff ne déclenche pas `style.load` : à ne pas oublier pour tout futur fond dérivé
  de Liberty.
- `python` sous Windows écrit les fichiers en CRLF : normaliser en LF (`sed -i 's/\r$//'`) avant
  `prettier --check`.

## Tests et vérifications

- TDD, tests vus en échec avant le code :
  - `styles.test.ts` : 7 tests (`toHybrid` : ordre et filtrage des couches, source Esri, sprite et
    polices gardés, source inutilisée retirée, couleurs des libellés sauf panneaux, routes
    translucides, style reçu non modifié ; `styleFor` et `transformFor` des trois fonds) ;
  - `e2e/map-styles.spec.ts` : clic sur « Satellite », bouton pressé et tuiles Esri demandées,
    retour au plan (échec initial : bouton absent).
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (234 + 187 + 317), `pnpm build` : OK.
- `pnpm test:e2e` : 52 passés, 3 en délai dépassé sous charge (auth, home, smoke) ; relancés avec
  `--workers=1` : tous passés.
- Vérification visuelle avec les vraies tuiles (page de test isolée, MapLibre et `styles.ts`) :
  Louvre au zoom 15 et Europe au zoom 4,5, imagerie, routes et libellés lisibles, attribution
  affichée. Pilule et recherche mesurées à 375 et 1280 px dans le build servi par `wrangler dev`.
- Non vérifié automatiquement : tracés et lieux toujours affichés après le passage au satellite
  (canevas WebGL illisible par les e2e) ; assuré par `diff: false` et `style.load`.

## Revue

Aucun point bloquant. Vérifié : pas d'élément `position: fixed` dans la carte (la requête de
conteneur crée un bloc conteneur), pas d'enfant injecté dans `TripMap`.

## Reste à faire

- « Préparer hors ligne » ne télécharge pas l'imagerie satellite (seulement OpenFreeMap).
- Hors des zones bien couvertes, Esri renvoie une image « données non disponibles » aux plus forts
  zooms.
