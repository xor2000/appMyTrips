# Fond de carte « Plan OSM France »

- Date : 2026-11-23
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur)

## Demande

Ajouter « Plan OSM France » aux fonds de carte, comme sur le site de référence
(`C:\MyDatas\Temp\game2`).

## Ce qui a été fait

- `apps/web/src/lib/map/styles.ts` : `OSMFR_STYLE`, style raster des tuiles d'OpenStreetMap France
  (`https://{a,b,c}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png`, zoom 20 au plus, mentions OSM
  France et contributeurs OpenStreetMap) ; nouvel identifiant `osmfr` dans `MapStyleId` ;
  `styleFor('osmfr')`.
- `BasemapPicker.svelte` : « Plan OSM France » juste après « Plan ».
- `apps/web/vite.config.ts` : cache du service worker `osmfr-tiles` (CacheFirst, 5 000 tuiles,
  60 jours), comme Topo et Satellite.
- `docs/specification.md` : fonds de carte (quatre fonds, Topo décrit au passage).

## Décisions et pourquoi

- **URL et mentions de la référence** (`osmfr`, sous-domaines a, b, c, zoom 20) : même service que
  le site de référence, sans clé.
- **Ordre** : après « Plan », comme la référence (les deux plans côte à côte).
- **Pas de préchargement hors ligne** : « Préparer hors ligne » ne précharge que le plan
  vectoriel ; les tuiles OSM France vues sont gardées par le service worker.

## Bugs et pièges rencontrés

- **E2E** : `getByRole('menuitemradio', { name: 'Plan' })` trouvait aussi « Plan OSM France »
  (recherche partielle de Playwright) : `exact: true` dans `map-styles.spec.ts`.

## Tests et vérifications

- TDD, vus en échec avant le code : `styles.test.ts` (style raster, URL des trois sous-domaines,
  zoom 20, mentions, `transformFor` = protection seule) et `BasemapPicker.test.ts` (quatre fonds
  dans l'ordre, clavier sur quatre éléments).
- E2E : `e2e/map-styles.spec.ts` choisit « Plan OSM France », vérifie qu'il est coché et que la carte
  demande des tuiles `tile.openstreetmap.fr` (interceptées).
- Une vraie tuile vérifiée (`a.tile.openstreetmap.fr/osmfr/12/2074/1409.png` : 200, PNG).
- `pnpm lint`, `pnpm typecheck` propres ; tests web : 319.
- `pnpm test:e2e --workers=2` (build compris) : 57 sur 59 ; `map-styles` (sélecteur ambigu,
  corrigé) et `auth` blocage (délai) relancés avec `--workers=1` : 7 sur 7.

## Revue

- Rien de bloquant.

## Reste à faire

- Rien.
