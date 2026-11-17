# Accueil illustré : photos de couverture Wikimedia Commons

- Date : 2026-11-17
- Type : fonctionnalité
- Issue : aucune (demande de l'utilisateur ; maquette en artifact « MyTrips · accueil illustré »)

## Demande

Rendre la page d'accueil plus attractive et faire reconnaître chaque voyage d'un coup d'œil :
une photo de la destination trouvée dans une banque d'images libre (Wikimedia Commons retenu),
une présentation plus engageante. Les voyages existants sans photo en reçoivent une
automatiquement à l'accueil.

## Ce qui a été fait

- **Core** (`packages/core/src/cover/cover.ts`) : schéma `TripCover` (url 1280 px, vignette
  640 px, auteur, licence, page source), `coverQuery` (mots-clés tirés du nom ou des étapes),
  `commonsSearchUrl`, `parseCommonsResponse` (filtre des photos). `Trip.cover`, `TripPatch.cover`
  et, dans `TripSummary`, `stepCount`, `distanceM` et `places`.
- **API** : migration `0008_trip_cover.sql` (`trips.cover`, table `cover_cache`), route
  `GET /api/covers?q=` (`routes/covers.ts`, cache D1 de 30 jours, `COMMONS_URL`), `PATCH` du
  voyage avec `cover` (hôtes restreints, `400 invalid_cover`), chiffres et lieux dans la liste.
- **Front** :
  - `TripCard` refaite en carte photo (nom sur la photo, état, chiffres, lieux, crédit) ;
  - `NextTrip` met en avant le voyage en cours ou le prochain départ ;
  - accueil groupé « En cours et à venir » / « Souvenirs » (`lib/home.ts`) ;
  - photo automatique (`lib/covers.ts`) ;
  - `CoverPicker` dans « Modifier le voyage » ;
  - teinte partagée (`lib/trips/tint.ts`), variables `--photo-*` dans `themes/pastel.css` ;
  - cache du service worker étendu à `thumb.wikimedia.org`.
- **E2e** : Commons factice dans `e2e/mock-services.mjs` (3 photos et une image PNG),
  `COMMONS_URL` passé à `wrangler dev`.

## Décisions et pourquoi

- **Wikimedia Commons** (choix de l'utilisateur) : sans clé, licences libres, déjà utilisé pour
  la découverte de lieux. Recherche par le Worker (User-Agent identifié, cache), jamais par le
  navigateur.
- **Photo automatique à l'accueil, une seule fois** : pas de rafale (un voyage après l'autre),
  seulement les voyages modifiables ; sans résultat, le voyage est noté sur l'appareil
  (`mytrips.coverTried`) plutôt qu'en base, pour ne pas ajouter de colonne pour un simple essai.
- **Hôtes restreints pour une photo enregistrée** : sans ça, l'éditeur d'un voyage partagé pourrait
  faire charger aux lecteurs une image de son serveur (pistage par l'adresse IP). Seuls
  `upload.wikimedia.org`, `thumb.wikimedia.org` et `commons.wikimedia.org` (plus l'origine de
  `COMMONS_URL` pour les e2e) sont acceptés.
- **Choix de la photo dans « Modifier le voyage »**, déplié sur place (pas de fenêtre dans la
  fenêtre) ; la photo n'est envoyée que si elle a changé.
- Mise en avant et cartes sont des `article` avec le même lien « Ouvrir le carnet » et le même
  bouton « Supprimer » : les e2e existants les trouvent où qu'elles soient rangées.

## Bugs et pièges rencontrés

- **Commons sert ses vignettes depuis `thumb.wikimedia.org`** (constaté sur l'API réelle), pas
  seulement `upload.wikimedia.org` : règle du service worker et liste des hôtes autorisés élargies.
- **Numérotation des photos** : le sélecteur retirait la photo actuelle des résultats, si bien que
  « Photo 2 » désignait la 3e photo trouvée (révélé par l'e2e). La liste suit désormais l'ordre de
  la recherche ; la photo actuelle n'est ajoutée à part que si elle manque.
- **Copie hors ligne de la liste** enregistrée avant la mise à jour : sans `cover`, `places`…
  (`places.length` aurait planté). Complétée au chargement (`normalizeTripSummary`) ; la copie
  écrite depuis un voyage complet calcule les mêmes chiffres que l'API (`summaryFromSnapshot`).
- `packages/core` n'a pas les types DOM : ni `URL` ni `URLSearchParams` (URL construite à la main).
- Les liens de crédit sont externes : `svelte/no-navigation-without-resolve` désactivée au cas par
  cas, comme pour Wikipédia dans `PoiCard`.

## Tests et vérifications

- TDD, vus en échec puis au vert :
  - core `cover.test.ts` ;
  - API `covers.test.ts` (recherche, cache, `COMMONS_URL`, 400/502, photo du voyage, hôtes
    refusés, lecteur, chiffres de la liste) ;
  - web `home.test.ts`, `covers.test.ts`, `format.test.ts` (`tripPhase`), `TripCard.test.ts`,
    `NextTrip.test.ts`, `CoverPicker.test.ts`, `TripFormDialog.test.ts` ;
  - e2e `home.spec.ts` (photo proposée à l'accueil puis changée, « Souvenirs »).
- Écrits après coup :
  - le test de numérotation stable de `CoverPicker` (après la correction révélée par l'e2e) ;
  - le test de l'image qui ne charge plus.
- Deux tests d'API passaient avant l'implémentation (photo mal formée, lecteur) : ils protègent un
  comportement attendu ; le premier ne vérifie vraiment la validation qu'une fois le champ accepté.
- Vérifié sur l'API réelle de Commons, dans le build servi par `wrangler dev` : photos trouvées pour
  « Alpes » et « Lisbonne », crédit, mise en avant « Prochain départ · 17 jours ».
- Suites complètes : voir le compte rendu de la session.

## Revue

- Hôtes de photo non restreints (pistage possible) : corrigé, avec tests.
- Image cassée si la photo disparaît de Commons : masquée, la teinte reprend (test).
- Ouvert : qualité inégale du premier résultat de Commons ; `cover_cache` jamais purgé.

## Reste à faire

- **Appliquer la migration `0008` en production avant de déployer**
  (`pnpm --filter @mytrips/api db:migrate:remote`).
