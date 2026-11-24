# Tracé complet des trajets (OSRM et Transitous), sans allègement

- Date : 2026-11-24
- Type : fonctionnalité (API)
- Issue : aucune (demande de l'utilisateur)

## Demande

Supprimer l'allègement à pas fixe et enregistrer le tracé complet d'OSRM, pour des trajets aussi
précis que sur le site de référence.

## Ce qui a été fait

- `apps/api/src/routing/providers.ts` : `thin` et `MAX_POINTS` (600 points, un point sur n)
  supprimés. OSRM est appelé avec `geometries=polyline` (précision 5, le format de
  `legs.geometry`) : la polyligne reçue est enregistrée telle quelle, sans décodage ni
  réencodage. Transitous : tracé entier (polylignes des étapes concaténées).
- `apps/api/src/db/legs.ts` : clé du cache `route_cache` en `v2` (`car:v2:…`) : les itinéraires
  déjà en cache, allégés, ne sont plus servis.
- `e2e/mock-services.mjs` : le faux OSRM renvoie une polyligne (encodeur de Google, vérifié sur
  l'exemple de référence `_p~iF~ps|U_ulLnnqC_mqNvxq`@`).
- `docs/specification.md` : routage et cache.

## Décisions et pourquoi

- **Polyligne plutôt que GeoJSON** : même tracé, réponse plus légère, et le Worker gratuit (10 ms
  de CPU par requête) n'a ni tableau de milliers de coordonnées à parcourir ni réencodage.
- **Version du cache** plutôt qu'une purge : les anciennes lignes expirent seules (30 jours) et
  aucune requête de nettoyage n'est nécessaire.
- **Trajets déjà enregistrés** : gardent leur tracé allégé jusqu'à « Recalculer » (le recalcul
  passe par la nouvelle clé de cache).

## Bugs et pièges rencontrés

- Aucun.

## Tests et vérifications

- TDD, vus en échec avant le code (6 échecs) : URL `geometries=polyline` (3 modes), tracé OSRM de
  2 000 points enregistré à l'identique, ancien cache ignoré (nouveau calcul, tracé complet),
  tracé Transitous de 1 500 points gardé entier.
- Vraie requête : Paris → Marseille en voiture, `code: Ok`, 776 km, polyligne de 42 667
  caractères.
- `pnpm lint`, `pnpm typecheck` propres ; `pnpm test` : core 234, API 195, web 334 ;
  `pnpm test:e2e --workers=2` (build compris) : 65 sur 65.

## Revue

- Rien de bloquant. Taille : un long trajet pèse quelques dizaines de Ko dans l'instantané du
  voyage (accepté pour la précision demandée).

## Reste à faire

- Recalculer les trajets existants pour obtenir leur tracé complet (« Recalculer » dans l'éditeur
  du trajet).
