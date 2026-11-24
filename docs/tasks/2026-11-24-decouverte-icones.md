# Découverte : icônes dans les pastilles et dans la popup

- Date : 2026-11-24
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur, maquette validée avant le code)

## Demande

Dans « Explorer », mettre une petite icône du type dans les cercles de la carte. Dans la popup :
retirer la source (« Geoapify · OpenStreetMap ») de la catégorie et l'afficher en petit sous
l'adresse, garder la catégorie en couleur, ajouter l'icône à gauche du nom.

## Ce qui a été fait

- `lib/map/poiIcons.ts` (nouveau) : `stepIconSvg` rend l'icône Lucide d'un type (`STEP_ICONS`, la
  même que dans la timeline) en SVG autonome ; `loadStepIconImage` en fait une image (13 px,
  densité 2).
- `lib/map/pois.ts` : propriété `icon` (`poiIconId(type)`) sur chaque lieu ; pastilles de 11 px
  (15 px actif, opacité 0,85 au repos) ; `poiIconLayer` : couche `symbol` au-dessus des pastilles,
  icônes toujours affichées (`icon-allow-overlap`, `icon-ignore-placement`).
- `TripMap.svelte` : la couche des icônes est créée avec celle des pastilles ; `addPoiIcons` charge
  les images une fois par page et les ajoute à chaque fond. Décalage de la popup d'un lieu porté à
  20 px (pastille agrandie). `__mapPoisForTests` donne aussi l'icône et si son image est chargée.
- `lib/map/popups.ts` : champs `icon` et `source` de `MapPopupContent` ; catégorie réduite au type
  (« Musée »), source à part (absente pour « Point sur la carte »).
- `MapPopup.svelte` : pastille ronde de 22 px avec l'icône, dans la couleur du type, à gauche du
  nom ; source en 11 px, gris, sous les notes.
- `docs/specification.md` : popup du lieu découvert, clic droit, lieux sur la carte.

## Décisions et pourquoi

- **Couche `symbol` et images générées** : MapLibre dessine les pastilles en WebGL, il ne peut pas y
  placer de composant. Rendre l'icône Lucide déjà utilisée en SVG garde une seule source d'icônes,
  sans dépendance ni fichier d'image à maintenir. Les pastilles restent la couche cliquable.
- **Image vide remplacée** : pendant le chargement des images, le résolveur d'images manquantes
  (`missingImageResolver`) pose une image transparente sous le même nom ; `addPoiIcons` la retire
  avant d'ajouter la vraie (sinon `hasImage` serait vrai et l'icône jamais posée).
- **Pastilles agrandies** (7 → 11 px de rayon) : une icône n'est pas lisible dans 14 px.

## Bugs et pièges rencontrés

- E2E « choisir un lieu dans la liste… » : après le clic sur un lieu de la liste, la carte se
  déplace et « Rechercher dans cette zone » apparaît, ce qui décale la liste sous la souris restée
  immobile ; Chromium marque alors le Louvre comme survolé. Le test éloigne la souris avant de
  vérifier le lieu actif.

## Tests et vérifications

- TDD, vus en échec avant le code (9 cas) : `pois.test.ts` (icône dans les propriétés, rayons,
  couche des icônes, identifiant d'image), `poiIcons.test.ts` (SVG autonome, une icône par type),
  `popups.test.ts` (catégorie, icône, source ; « Point sur la carte » sans source),
  `MapPopup.test.ts` (icône à gauche du nom, source sous l'adresse ; rien pour une étape).
- E2E : `poi.spec.ts` (icône musée chargée sur chaque pastille ; popup : catégorie, icône, source),
  `step-popup.spec.ts` (clic droit : catégorie et source séparées).
- Captures (build servi par `wrangler dev`) : pastilles avec icône (musées, café) ; popup « MUSÉE »,
  icône et nom, adresse, « OpenStreetMap » en petit.
