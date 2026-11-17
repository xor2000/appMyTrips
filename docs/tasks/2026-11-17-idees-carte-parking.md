# Idées sur la carte et type « Parking »

- Date : 2026-11-17
- Type : fonctionnalité
- Issue : aucune (demande de l'utilisateur)

## Demande

Un lieu mis dans les idées doit apparaître sur la carte, sans être relié aux trajets. Ajouter un
type d'étape « Parking » avec son icône.

## Ce qui a été fait

- `apps/web/src/lib/map/points.ts` : les idées qui ont un lieu s'ajoutent aux marqueurs, en vue d'un
  jour comme de tout le voyage (`idea: true`, étiquette « Idée », hors numérotation).
- `TripMap.svelte` : marqueur « Idée » clair à contour pointillé de la couleur du type, sous les
  étapes ; le cadrage suit les étapes placées (les idées seulement s'il n'y a rien d'autre).
- `packages/core/src/step/types.ts` : type `parking` (« Parking », couleur des transports, 10 min
  sur place) ; `osm.ts` : `amenity=parking` et `amenity=parking_entrance` → `parking`.
- `apps/web/src/lib/steps/icons.ts` : icône lucide `square-parking`.

## Décisions et pourquoi

- Pas de trajet : les tracés viennent des trajets, qui ne relient que des étapes placées ; une idée
  n'entre donc ni dans les paires ni dans les tracés (rien à changer côté trajets).
- Le cadrage ignore les idées : une idée lointaine ne doit pas dézoomer la carte d'un jour.
- Le type est une colonne texte sans contrainte en base : pas de migration.

## Tests et vérifications

- TDD, vus en échec puis au vert : `types.test.ts` (Parking), `osm.test.ts` (tags de parking),
  `points.test.ts` (idées en vue jour et d'ensemble, hors numérotation, sans lieu ignorées) ;
  e2e `steps.spec.ts` (« une idée apparaît sur la carte, sans numéro ni trajet », « type
  « Parking » »).
- Test existant mis à jour : la vue d'ensemble ignorait les idées, c'est le comportement demandé
  qui change.
- Suites : voir le compte rendu de la session.

## Retour après déploiement

- Le repère d'une idée affiche une ampoule (icône lucide `lightbulb`, construite en SVG dans
  `TripMap.svelte`, les marqueurs étant créés hors des composants Svelte) au lieu du mot « Idée » ;
  le nom accessible reste « Idée · nom ». E2e `steps.spec.ts` complété (icône présente, aucun
  texte), vu en échec puis au vert.
