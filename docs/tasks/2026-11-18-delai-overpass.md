# Délai d'Overpass avant le secours Geoapify

- Date : 2026-11-18
- Type : correction
- Issue : aucune (constaté en production après l'ajout de la clé Geoapify)

## Demande

Les instances publiques d'Overpass étant saturées, chaque recherche de lieux attendait 8,5 à 17 s
avant le secours Geoapify (journaux du Worker du 17/11 au soir). Réduire ce délai.

## Ce qui a été fait

- `apps/api/src/poi/providers.ts` : `TIMEOUT_MS` (8 s, partagé) remplacé par
  `OVERPASS_TIMEOUT_MS = 4000` (par instance) et `GEOAPIFY_TIMEOUT_MS = 8000`.
- `docs/specification.md` (§6, découverte de lieux) : délais mis à jour.

## Décisions et pourquoi

- **4 s par instance Overpass** : une instance saine répond en quelques secondes sur une zone
  visible ; au pire, deux instances muettes retardent le secours de 8 s au lieu de 16.
- **Geoapify garde 8 s** : c'est le dernier recours, rien ne vient après lui.
- Écartés pour l'instant : mémoriser une instance en panne quelques minutes, ou interroger les
  fournisseurs en parallèle (charge doublée sur Overpass, contraire à sa politique d'usage).

## Bugs et pièges rencontrés

- En production le 17/11 : `overpass-api.de` répondait `521`, `502` ou ne répondait pas ;
  `overpass.private.coffee` dépassait toujours le délai. CPU mesuré par requête : 4 à 9 ms (limite
  de 10 ms du Worker gratuit) avec le secours Geoapify.

## Tests et vérifications

- TDD, vu en échec (abandon à 8 020 ms) puis au vert : `apps/api/test/poi.test.ts`, « abandonne
  une instance Overpass muette au bout de 4 s, mais laisse 8 s à Geoapify » (Overpass muet,
  Geoapify qui répond en 5 s).
- Pas de nouvel e2e : les services factices répondent tout de suite, un délai de 4 s y serait
  coûteux sans rien prouver de plus ; `e2e/poi.spec.ts` couvre le parcours.
- Résultats (vrais codes de sortie) : lint 0, typecheck 0, unitaires 713/713 (core 234, api 187,
  web 292), build 0, e2e 48/48 (`--workers=1`).
- Non vérifié en production (pas encore déployé).

## Revue

- Rien à corriger : changement limité aux deux délais, les autres appelants (`poi.ts`) ne
  dépendent pas de leur valeur.

## Reste à faire

- Déployer, puis vérifier dans les journaux (`wrangler tail`) que le secours arrive en 4 à 8 s.
