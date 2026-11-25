# Illustrations dessinées à la place des photos Wikimedia Commons

- Date : 2026-11-25
- Type : fonctionnalité
- Issue : #60

## Demande

Supprimer toute utilisation de Wikimedia Commons : les photos de couverture trouvées
automatiquement étaient souvent hors sujet. Les remplacer par des illustrations « flat design »,
une par type de voyage (randonnée, plage, montagne, roadtrip en voiture, van, camping-car…).

## Ce qui a été fait

- **Core** (`packages/core/src/illustration/illustration.ts`) : liste des 24 thèmes
  (`ILLUSTRATIONS`, `IllustrationId`, libellés français), `parseIllustration` (valeur inconnue :
  null) et `suggestIllustration(nom, lieux)`. `Trip`, `TripPatch` et `TripSummary` portent
  `illustration` au lieu de `cover`. `core/cover` supprimé.
- **API** :
  - migration `0011_trip_illustration.sql` : `trips.illustration`, suppression de `trips.cover`
    et de la table `cover_cache` ;
  - `PATCH` du voyage avec `illustration` ;
  - suppression de `routes/covers.ts`, `db/coverCache.ts`, `coverIsAllowed`, `COMMONS_URL` et
    `invalid_cover`.
- **Front** :
  - 48 SVG dessinés pour le projet dans `lib/illustrations/` (une scène 160 × 100 et un
    pictogramme 48 × 48 par thème), coloriés par les variables `--illu-*` de chaque thème ;
  - `Illustration.svelte` affiche un pictogramme (chargé avec la page) ou une scène (module à part,
    importé au premier affichage) ;
  - `IllustrationPicker.svelte` (grille `.cat-grid`, « Automatique » puis les 24 thèmes) remplace
    `CoverPicker` dans « Modifier le voyage » ;
  - `TripSwitcher` affiche le pictogramme choisi ou suggéré, sinon l'initiale ;
  - `normalizeTripSummary` oublie l'ancienne `cover` des copies hors ligne et valide l'identifiant ;
  - `searchCovers` supprimé.
- **E2e** : Commons factice retiré de `mock-services.mjs`, `COMMONS_URL` retiré de
  `playwright.config.ts`, `home.spec.ts` réécrit (choix d'une illustration, suggestion par le nom).

## Décisions et pourquoi

- **Dessins faits pour le projet** (choix de l'utilisateur) plutôt qu'unDraw : sa licence
  déconseille de mettre ses illustrations dans une application et interdit de les redistribuer
  (« in packs or otherwise »), or le dépôt est public ; son catalogue n'a ni van, ni camping-car,
  ni ski, ni montagne. Aucun service gratuit n'offre une API de recherche avec une licence propre.
- **Scène et pictogramme** (choix de l'utilisateur) : la couverture ne s'affiche qu'en vignette de
  26 et 44 px, où une scène est illisible.
- **Suggestion à l'affichage, sans rien enregistrer** : les voyages sont illustrés sans action, et
  l'amélioration des mots-clés profite aux voyages existants. Les anciennes photos ne sont pas
  converties (colonne supprimée) : ces voyages reçoivent la suggestion.
- **Seuls des paysages sont cherchés dans les lieux, avec des mots-clés plus stricts**
  (`PLACE_KEYWORDS`) : une gare, un aéroport ou une ville se trouvent dans presque tous les
  voyages, et « Île de la Cité », « Bois de Boulogne », « Mer de Glace » ou « Côte de Nuits » ne
  disent rien d'une île, d'une forêt ou de la plage. La fenêtre et l'en-tête cherchent dans les
  mêmes lieux : les 3 premiers de la liste des voyages (`summaryFromSnapshot`).
- **Identifiant validé par un `enum` Zod** : plus d'URL enregistrée, donc plus de pistage possible
  par l'image (la raison d'être de l'ancien `invalid_cover`).
- **Règle Workbox `(upload|thumb).wikimedia.org` gardée** : elle sert aussi aux vignettes des
  résumés Wikipédia de la découverte de lieux (le plan prévoyait de la retirer ; seul son
  commentaire change).
- Lot de 6 thèmes montré à l'utilisateur dans les 3 thèmes avant de dessiner les 18 autres.

## Bugs et pièges rencontrés

- **Vitest ne charge pas le CSS** : `import x from '…css?raw'` donne une chaîne vide. Et sous jsdom,
  `import.meta.url` n'est pas une adresse `file:` (`readFileSync(new URL(…))` échoue). Le test des
  variables lit les thèmes par `readFileSync` depuis le dossier du paquet.
- Premier import du module des scènes lent en test (transformation par Vite) : délai de `waitFor`
  porté à 5 s.
- Roues du vélo (contour seul) presque invisibles en thème sombre avec l'encre : passées en roche.
- Une réponse non JSON (route inconnue, « 404 Not Found » de Hono) faisait planter `call()` des
  tests d'API : le corps est maintenant rendu en texte brut s'il n'est pas du JSON.

## Tests et vérifications

- TDD, vus en échec puis au vert :
  - core `illustration.test.ts` (liste, libellés, `parseIllustration`, `suggestIllustration`,
    `TripPatch`) ;
  - API `illustration.test.ts` (enregistrement, effacement, 400, lecteur, valeur inconnue en base,
    `/api/covers` en 404, colonne et table supprimées) ; les tests de la liste des voyages
    (chiffres et lieux) déplacés dans `trip-summary.test.ts` ;
  - web `illustrations.test.ts`, `Illustration.test.ts`, `TripSwitcher.test.ts`,
    `TripFormDialog.test.ts`, `home.test.ts`.
- Deux tests d'API passaient avant l'implémentation (identifiant inconnu refusé, lecteur refusé) :
  ils protègent un comportement attendu.
- E2e `home.spec.ts` (choix d'une illustration, suggestion par le nom) et `header.spec.ts` écrits
  après le front : ils n'ont pas été vus en échec.
- Suites complètes : lint, typecheck, build, unitaires (core 244, API 194, web 474) au vert ;
  e2e : 94 sur 95 avec `--workers=1`. L'échec (`trips.spec.ts:83`, flèche « Jours suivants » qui
  se désactive entre `isEnabled()` et `click()`) est une course du test, sans rapport : relancé
  4 fois, au vert. Un premier passage avec 8 workers, machine chargée, avait donné 61 délais
  dépassés en série (session, connexion).
- Vérifié dans l'application réelle (build servi par `wrangler dev`, captures) : « Automatique :
  Van » pour « Road trip en van », grille des 25 choix dans « Modifier le voyage », pictogrammes
  dans le bouton et la liste des voyages, initiale sans suggestion. Les 24 dessins vérifiés dans
  les 3 thèmes (pastel clair et sombre, carnet). Légende « Illustration » de la grille masquée à
  l'écran (doublon du titre), gardée pour les lecteurs d'écran.

## Revue

Revue indépendante (sous-agent) : 0 bloquant, 3 importants, 8 mineurs.

- Corrigés :
  - ordre de déploiement non documenté (voir « Reste à faire ») ;
  - suggestion différente dans la fenêtre (tous les lieux) et dans l'en-tête (3 premiers lieux) :
    la fenêtre reçoit les lieux du résumé ;
  - échec de chargement des scènes gardé en cache pour toute la session : la promesse est oubliée
    en cas d'échec (test), et `{:catch}` laisse la case vide ;
  - faux positifs dans les lieux (« Île de la Cité », « Bois de Boulogne », « Mer de Glace »,
    « Côte de Nuits ») : mots-clés propres aux lieux (test) ;
  - caractères combinants écrits tels quels dans l'expression régulière : `\p{M}` ;
  - rayon `6px` en dur : `var(--radius-sm)` ;
  - aucun test n'interdisait script, gestionnaire d'événement, lien ou `foreignObject` dans les SVG
    insérés par `{@html}` : ajouté.
- Écarté : documentation périmée (relue avant sa mise à jour, déjà faite).
- Laissé : « Côte d'Ivoire » dans le nom d'un voyage donne la plage (« Côte d'Azur » est bien plus
  fréquent dans un nom de voyage).

## Reste à faire

- **En production : déployer le Worker, puis appliquer aussitôt la migration `0011`**
  (`pnpm run deploy`, puis `pnpm --filter @mytrips/api db:migrate:remote`). Les lectures font
  `SELECT *` : le nouveau Worker lit les voyages sans la colonne `illustration` (null, donc
  suggestion), et seul le choix d'une illustration échoue jusqu'à la migration. Dans l'ordre
  inverse, l'ancien Worker répondrait 500 sur `/api/covers` et sur un changement de photo. La
  migration est irréversible (`DROP COLUMN cover`, `DROP TABLE cover_cache`).
