# Lieux de la découverte en WebGL, infobulle, marqueurs sans décalage

- Date : 2026-11-18
- Type : fonctionnalité et correction
- Issue : aucune (demande de l'utilisateur)

## Demande

- Dans « Explorer », un lieu choisi dans la liste doit être mis en évidence sur la carte, avec une
  petite infobulle portant son nom.
- Les marqueurs d'étapes et des lieux suivaient mal les déplacements de la carte.
- Prendre exemple sur `appMyTraces` (lieux affichés sur MapLibre, description au clic, sans
  latence).

## Ce qui a été fait

- `apps/web/src/lib/map/pois.ts` (nouveau) : `poiFeatureCollection` (un point par lieu, avec son
  identifiant, son nom et la couleur de son type), `poiLayer` (couche `circle`, plus grande et
  opaque quand l'état `active` est posé), `closestPoiId` (lieu le plus proche du clic).
- `apps/web/src/lib/components/TripMap.svelte` :
  - lieux dessinés par la source GeoJSON `pois` (`promoteId: 'id'`) au lieu de marqueurs HTML ;
    état `active` sur le lieu survolé ou sélectionné (`setFeatureState`), remis à zéro à chaque
    nouvelle donnée ou changement de fond ;
  - survol (curseur, `onHoverPoi`) et clic au plus près, avec une marge de 8 px
    (`queryRenderedFeatures`) ;
  - infobulle `maplibregl.Popup` (classe `poi-popup`, nom en `textContent`) sur le lieu
    sélectionné, carte déplacée vers lui s'il est hors de la vue ;
  - `whenStyleReady` : synchronisation des tracés et des lieux reportée à l'événement `idle` quand
    des tuiles chargent ;
  - marqueurs d'étapes : plus de `transition: transform` ; la mise en évidence passe par
    `scale: 1.25` (origine en bas, à la pointe du marqueur) ;
  - accès de test `window.__mapPoisForTests` et `window.__mapProjectForTests`, retirés au
    démontage.
- Documentation : `docs/specification.md` (§6 et §9), `CLAUDE.md` (deux pièges MapLibre).

## Décisions et pourquoi

- **WebGL plutôt que marqueurs HTML pour les lieux**, comme `appMyTraces` (`tracePoiLayer.ts`,
  `MapView.svelte`) : dessinés avec la carte, ils la suivent exactement, et des centaines de
  pastilles ne coûtent pas un élément DOM chacune. Couche `circle` plutôt que `symbol` : pas
  d'icône à dessiner ni de police à charger, et elle fonctionne aussi sur le fond Topo, qui n'a ni
  sprite ni glyphes.
- **Marqueurs d'étapes gardés en HTML** : peu nombreux, ce sont des boutons accessibles (nom,
  clic), utilisés par les e2e ; seule la cause de leur décalage est corrigée.
- **Infobulle seulement pour le lieu sélectionné** : le survol garde la mise en évidence ; une
  infobulle qui suit la souris masquerait les pastilles voisines.
- **Pas de désélection au clic dans le vide** : comportement inchangé (second clic sur le lieu ou
  dans la liste).

## Bugs et pièges rencontrés

- **Cause du décalage** : `.map-marker` et `.poi-marker` avaient `transition: transform 0.12s`.
  MapLibre positionne chaque marqueur par un `transform` en ligne : chaque déplacement était donc
  animé sur 0,12 s. Le `transform: scale(1.25)` de mise en évidence était, lui, écrasé par le
  style en ligne.
- **`isStyleLoaded()`** (MapLibre 6) renvoie `style.loaded()`, faux tant qu'une source charge des
  tuiles : `syncLines` sortait sans rien faire et sans réessayer. Une mise à jour des tracés
  arrivée pendant un déplacement de la carte était perdue jusqu'au changement suivant ; elle est
  maintenant reportée à `idle`.
- Les lieux n'étant plus dans le DOM, les e2e passent par les accès de test de la carte (même
  approche que `appMyTraces`).

## Tests et vérifications

- TDD, vus en échec puis au vert :
  - `apps/web/src/lib/map/pois.test.ts` (5) : points et propriétés, collection vide, couche
    active, lieu le plus proche, aucun lieu ;
  - `e2e/poi.spec.ts` : lieux dessinés (au lieu des `.poi-marker`), « choisir un lieu dans la
    liste le met en évidence sur la carte, avec son nom » (infobulle, état `active`,
    désélection), « cliquer un lieu sur la carte le sélectionne dans la liste », « les marqueurs
    d'étapes suivent la carte sans animer leur position ».
- Suites : voir le compte rendu de la session.
- Non testé automatiquement : le report à `idle` (il faut des tuiles qui chargent, absentes des
  e2e) ; non vérifié à l'œil avec les vraies tuiles.

## Revue

- Corrigé : les états `active` étaient oubliés au lieu d'être effacés lors d'une nouvelle donnée
  (`removeFeatureState` sur la source) ; accès de test retirés au démontage.
- Laissé ouvert : pastilles inaccessibles au clavier sur la carte (la liste l'est) ; couleurs
  figées jusqu'à la recherche suivante après un changement de thème (noté en §9).

## Reste à faire

- Vérifier à l'œil en production, avec les vraies tuiles.
