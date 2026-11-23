# Routage voiture, vélo et marche par OSRM (FOSSGIS) au lieu d'OpenRouteService

- Date : 2026-11-23
- Type : fonctionnalité (API)
- Issue : aucune (demande de l'utilisateur)

## Demande

Remplacer OpenRouteService par OSRM (`routing.openstreetmap.de`) pour le calcul des itinéraires
voiture, vélo et à pied (tracé et distance).

## Ce qui a été fait

- `apps/api/src/routing/providers.ts` : `osrmRoute` remplace `orsRoute`. Un serveur FOSSGIS par
  mode (`routed-car`, `routed-bike`, `routed-foot`), requête GET
  `/<serveur>/route/v1/driving/<lng>,<lat>;<lng>,<lat>?overview=full&geometries=geojson`,
  User-Agent du routage (`routingUserAgent`). Plus de clé : le routeur est toujours appelé.
- `apps/api/src/env.ts` : `OSRM_URL` (défaut `https://routing.openstreetmap.de`) remplace
  `ORS_API_KEY` et `ORS_URL`.
- `apps/api/vitest.config.ts` : `OSRM_URL` sur une adresse injoignable (`http://127.0.0.1:9`).
- `TripMap.svelte` : mention « Itinéraires : FOSSGIS (OSRM), signaler une erreur » (lien
  `openstreetmap.org/fixthemap`, exigé par la politique d'usage) à la place d'ORS.
- E2E : service factice OSRM (`e2e/mock-services.mjs`, sous `/osrm`), `OSRM_URL` passé à
  `wrangler dev` (`playwright.config.ts`).
- Docs : `docs/specification.md` (routage, secrets, décision, limites), `README.md`, `CLAUDE.md`
  (piège : routage en test).

## Décisions et pourquoi

- **Remplacement complet** (pas d'ORS en secours) : « remplace » dans la demande ; OSRM ne
  demande ni clé ni compte. (Ce paragraphe disait d'abord que la clé ORS n'avait jamais été
  créée : c'était faux, le secret `ORS_API_KEY` existait en production.)
- **Codes « aucune route »** : `NoRoute` et `NoSegment` (réponse 400), et une réponse `Ok` sans
  itinéraire, donnent `422 no_route` comme l'ancien 404 d'ORS. Tout autre échec (429, 5xx,
  `InvalidQuery`, réseau, délai) garde l'estimation locale.
- **Le corps est lu avant le statut** : OSRM renvoie ses codes d'absence de route dans un 400.
- **URL par concaténation** (piège connu) : une base avec chemin (relais, services factices) est
  gardée.
- **Adresse injoignable dans la config de test** : sans elle, tout test créant un trajet avec
  `call` (fetch réel) aurait appelé le vrai OSRM ; avant, l'absence de clé ORS l'empêchait.

## Bugs et pièges rencontrés

- Le changement retire la garde implicite « pas de clé, pas d'appel réseau » : voir la décision
  ci-dessus (`vitest.config.ts`) et la ligne ajoutée à `CLAUDE.md`.

## Tests et vérifications

- TDD : `apps/api/test/legs.test.ts` réécrit avant le code, 14 échecs constatés (estimation au lieu
  du routeur) : URL et serveur par mode (car, bike, walk), User-Agent, méthode GET ; erreurs 429,
  500, 503 et réseau, puis `InvalidQuery`, donnent une estimation ; `NoRoute`, `NoSegment` et `Ok`
  sans itinéraire donnent `422` ; base avec chemin gardée ; estimation non mise en cache puis
  routeur utilisé quand il revient.
- E2E : `e2e/legs.spec.ts` vérifie la mention « OSRM » (et l'absence d'« openrouteservice ») ; les
  parcours de trajets passent par le service factice OSRM.
- Format réel vérifié par deux requêtes à `routing.openstreetmap.de` (`routed-foot` et
  `routed-car`) : `code: "Ok"`, `routes[0].distance`, `duration`, `geometry.coordinates`.
- `pnpm lint`, `pnpm typecheck` propres ; `pnpm test` : core 234, API 192, web 312 ;
  `pnpm test:e2e --workers=2` (ports 8791/8801, build compris) : 56 sur 59, les 3 échecs par délai
  dépassé (`auth.spec` blocage, `schedule.spec` ×2) passent relancés avec `--workers=1` (avec
  `legs.spec`, sur le build final) : 13 sur 13.

## Revue

- Rien de bloquant relevé. Laissé : pas de limitation à une requête par seconde côté Worker (usage
  personnel, cache de 30 jours) ; noté dans les limites de la spécification.

## Reste à faire

- Fait après le déploiement : le secret de production `ORS_API_KEY`, devenu inutile, a été
  supprimé (`wrangler secret delete ORS_API_KEY`).
- Les trajets déjà estimés ne sont pas recalculés d'eux-mêmes : « Recalculer » sur la tuile.
