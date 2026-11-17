# Avertissements MapLibre du style Liberty

- Date : 2026-11-17
- Type : correction
- Issue : aucune (avertissements signalés par l'utilisateur dans la console)

## Demande

La console affichait en boucle deux familles d'avertissements MapLibre sur la carte « Plan » :

- `layers[highway-shield-non-us].filter[1]: Expected value to be of type number, but found null instead. Falling back to false.` (aussi `highway-shield-us-interstate` et `road_shield_us`, dans le fil principal et dans le web worker) ;
- `Image "sports_centre" could not be loaded…` (aussi `swimming_pool`, `gate`, `bollard`, `office`, `recycling`…).

## Ce qui a été fait

- `apps/web/src/lib/map/styles.ts` :
  - `guardMissingNumbers` : transformation de style qui ajoute `["has", propriété]` devant une comparaison numérique (`<`, `<=`, `>`, `>=`) entre `["get", propriété]` et un nombre, à la racine du filtre ou dans des `all` ;
  - `missingImageResolver` : enregistre une image transparente de 1 × 1 px pour une icône absente du sprite.
- `apps/web/src/lib/components/TripMap.svelte` : `transformStyle: guardMissingNumbers` à la création de la carte (MapLibre la réapplique à chaque `setStyle`, donc au changement de fond) et `setMissingStyleImageResolver(missingImageResolver(m))`.
- `docs/specification.md` (§6, Carte) : description des deux corrections.

## Décisions et pourquoi

- **Corriger le style au chargement plutôt que d'héberger une copie de Liberty** : le style d'OpenFreeMap reste à jour (URL de tuiles versionnées, sprites) ; la transformation est générique et ne vise aucun nom de couche.
- **`["has", …]` plutôt que `["coalesce", ["get", …], 99]`** : le résultat ne dépend pas d'une valeur arbitraire ni du sens de la comparaison.
- **Racine et `all` seulement** : MapLibre fait retomber le filtre **entier** sur `false` quand l'évaluation échoue. Un `false` local ne donne le même résultat que si toute la chaîne jusqu'à la racine est faite de `all`. Sous `!` ou `any`, le résultat changerait : ces cas sont laissés tels quels (aucun dans Liberty).
- **Image transparente** : MapLibre n'affiche déjà rien à la place d'une icône absente ; le rendu est identique, seul l'avertissement disparaît. Pas d'icône de remplacement, pour ne pas changer l'aspect de la carte.

## Bugs et pièges rencontrés

- Les deux avertissements viennent du style Liberty (`https://tiles.openfreemap.org/styles/liberty`), pas du code : propriété `ref_length` absente des routes sans numéro ; icônes de lieux nommées d'après la classe OSM, absentes du sprite `ofm_f384`.
- Sur Liberty, la transformation touche 8 couches sur 111 (`boundary_3`, `poi_r1`, `poi_r7`, `poi_r20`, les trois couches de panneaux, `label_country_3`), toutes dans des `all`.
- Les filtres des tuiles sont évalués dans le web worker de MapLibre : l'e2e écoute aussi la console des workers (`page.on('worker')`).

## Tests et vérifications

- TDD, vus en échec puis au vert :
  - `apps/web/src/lib/map/styles.test.ts` : filtre des panneaux de Liberty, comparaison de premier niveau et nombre à gauche, filtres laissés intacts (ancien format, égalité, deux propriétés), style reçu non modifié, comparaison sous `!` ou `any` non touchée (ajouté à la revue), image transparente de 1 × 1 px, pas de double ajout ;
  - `e2e/trips.spec.ts` : « la carte n'affiche pas d'avertissement pour les icônes absentes ni les propriétés manquantes » (style simulé reproduisant les deux défauts ; les deux avertissements apparaissaient avant la correction).
- Contrôle de la transformation sur le vrai style Liberty (script local) : 8 couches modifiées, filtres attendus.
- **Résultats finaux** (vrais codes de sortie, sur le code final) : lint 0, typecheck 0, unitaires
  712/712 (core 234, api 186, web 292), build 0, e2e **48/48** avec `--workers=1`.
- E2E en parallèle : la première passe (avant la correction de revue) donnait 47/48, avec pour seul
  échec le smoke du service worker, instabilité déjà connue (spécification §9). La seconde passe
  donnait 16 échecs, tous des délais dépassés à la création d'un voyage, sur une machine chargée
  (5,2 min au lieu de 2,3), sans rapport avec la carte. La relance avec `--workers=1`, comme le
  recommande `CLAUDE.md`, passe entièrement.

## Revue

- Point relevé : la première version protégeait les comparaisons à toute profondeur, ce qui aurait changé le résultat sous `!` ou `any`. Restreint à la racine et aux `all`, avec un test.

## Reste à faire

- Non vérifié à l'œil avec les vraies tuiles d'OpenFreeMap (les e2e interceptent les tuiles).
