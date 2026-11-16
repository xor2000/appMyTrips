# Lot 7 · Consultation hors ligne en lecture seule

- Date : 2026-11-16
- Type : fonctionnalité
- Issue : #9 (épique #1)

## Demande

Permettre la consultation hors ligne d'un voyage. Hors ligne, l'application est en lecture seule ; en ligne, on peut modifier. L'application, les données du voyage et les tuiles de la zone du voyage doivent rester disponibles sans réseau.

## Ce qui a été fait

- **`packages/core/src/offline/tiles.ts`** :
  - `tilesInBbox` (antiméridien, bornes de projection) et `padBbox` ;
  - `tripBboxes` (emprise de chaque jour) ;
  - `planOfflineTiles` (zooms 6 à 14, sans doublon, plafond de 4 000 tuiles) et `estimateTileBytes`.
- **`apps/web/src/lib/offline`** :
  - `store.ts` : copies datées de la liste et des voyages, voyage ajouté à la liste, voyages préparés, libération des tuiles propres à un voyage ;
  - `instance.ts` : IndexedDB via `idb-keyval` 6.3.0 ;
  - `load.ts` (`loadWithFallback`, `OfflineUnavailableError`, `isNetworkError`) ;
  - `connection.svelte.ts` ;
  - `prefetch.ts` (modèle d'URL des tuiles, polices, préchargement limité à 4 requêtes en parallèle, quota).
- **Composants** :
  - `components/offline/OfflineBanner.svelte`, `OfflineDialog.svelte`, `InstallPrompt.svelte` ;
  - `TripCard` : statut « Disponible hors ligne » et lecture seule.
- **Pages** :
  - accueil : liste hors ligne, bandeau, invite d'installation, création et suppression masquées hors ligne ;
  - voyage : chargement avec repli, lecture seule hors ligne, bouton « Préparer hors ligne » ;
  - copie gardée après chaque modification ; écriture échouée faute de réseau signalée ; rechargement au retour du réseau ; découverte de lieux masquée hors ligne.
- **Service worker** (`vite.config.ts`) : stratégies runtime pour OpenFreeMap (style, sprites, polices, TileJSON et tuiles), OpenTopoMap et les vignettes Wikipédia.
- **E2E** : `e2e/offline.spec.ts`.
- **Documentation** : spécification, `CLAUDE.md`, `README.md`.

## Décisions et pourquoi

- **Pas de cache service worker pour `/api`** (écart au plan) : en `NetworkFirst`, une réponse ancienne serait servie hors ligne comme fraîche et sans date, et l'application la croirait à jour. La copie IndexedDB est datée et suffit.
- **Stockage abstrait** (`KeyValue`) : IndexedDB en production, mémoire dans les tests. Pas de dépendance de test supplémentaire (`fake-indexeddb`).
- **Lecture seule = même mécanisme que le rôle `viewer`** : `canEdit` dépend de la connexion.
- **Pas d'option de zooms 15–16** : les tuiles vectorielles d'OpenFreeMap s'arrêtent au zoom 14.
- **Pas de GPX original à garder** : il n'est plus stocké depuis le lot 6 (pas de R2). Les tracés simplifiés sont dans l'instantané.
- **Polices** : plages latines 0–1023 des polices du style, pour que les étiquettes s'affichent hors ligne.

## Bugs et pièges rencontrés

- **Proxy Svelte non clonable** : enregistrer l'instantané `$state` dans IndexedDB échouait (« could not be cloned »). La copie après chaque modification échouait donc sans bruit. Correction : `$state.snapshot` ; le piège est noté dans `CLAUDE.md`.
- **Liste hors ligne incomplète** : un voyage créé ou ouvert après l'affichage de la liste n'y figurait pas. Le résumé du voyage est désormais ajouté à la copie de la liste à chaque chargement.
- **Service worker** : il ne contrôle la page qu'au chargement suivant son installation. L'e2e attend `ready`, recharge, puis vérifie `controller`.
- **Délai de l'e2e** : le parcours dépasse 30 s sous charge parallèle ; il a un délai de 90 s.

## Tests et vérifications

- **Unitaires** :
  - `core` (+11) : tuiles d'une emprise (zoom, emprise minuscule, antiméridien, bornes), marge, plan (zooms, doublons, fusion de jours, plafond, emprise vide), estimation, emprises d'un voyage (étapes, sorties, trajets, séjours ; idées exclues) ;
  - `web` (+27) :
    - magasin (copie datée, liste, ajout dans la liste, voyages préparés et libération) ;
    - chargement (frais, échec réseau, hors ligne, sans copie, erreur d'API) ;
    - connexion ;
    - préchargement (modèle d'URL, polices, parallélisme, progression, échecs, quota, interruption) ;
    - bandeau, fenêtre de préparation, invite d'installation, `TripCard`.
- **E2E (33 au total)**, dont le nouveau parcours :
  - préparer hors ligne (tuiles simulées) ;
  - `setOffline(true)` puis rechargement : voyage, horaires et bandeau daté, sans bouton d'édition ;
  - liste hors ligne avec le statut ;
  - `setOffline(false)` : l'édition revient.
- **Résultats finaux** (vrais codes de sortie) :
  - lint 0, typecheck 0, build 0 ;
  - unitaires 553/553 (core 213, api 148, web 192) ;
  - e2e 33/33 en mode CI ; le `smoke` du service worker reste instable par moments, problème déjà présent sur `main`.
- **Non vérifié à la main** :
  - consultation hors ligne avec les vraies tuiles ;
  - PWA installée ;
  - espace réellement utilisé ;
  - mise à jour de l'application avec un voyage en cache.

## Revue

- **Corrigé** : proxy non clonable (copie après modification perdue), liste hors ligne incomplète, délai de l'e2e.
- **Laissé ouvert, noté dans la spécification** :
  - quota dépassé dans le service worker invisible de la page ;
  - URL de tuiles versionnée d'OpenFreeMap (préparer de nouveau après une nouvelle version) ;
  - pas d'édition, de routage ni de recherche hors ligne.

## Reste à faire

- **Déploiement** de l'ensemble (lots 4 à 7) :
  - dépôt public sous licence open source et `CONTACT_URL` ;
  - migrations `0005` et `0006` ;
  - `pnpm run deploy`.
- **Vérifications manuelles** listées ci-dessus.
