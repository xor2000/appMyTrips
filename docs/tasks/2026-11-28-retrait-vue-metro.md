# Retrait de l'affichage « Ligne de métro »

- Date : 2026-11-28
- Type : autre (retrait de fonctionnalité)
- Issue : aucune

## Demande

Enlever tout ce qui concerne la vue « Ligne de métro » de la page d'un voyage.

## Ce qui a été fait

- Composants supprimés : `MetroLine.svelte`, `MetroStop.svelte` (`components/steps/`), `MetroLeg.svelte` (`components/legs/`) et leurs tests.
- `lib/layout.ts` : l'entrée `metro` de `LAYOUTS` est retirée ; il reste « Liste et carte » (`list`) et « Plein écran » (`board`).
- `LayoutPicker.svelte` (schéma `.sketch.metro`) et `LayoutSwitch.svelte` (icône `git-commit-horizontal`) : traces du troisième affichage retirées.
- `DropZone.svelte` : prop `vertical` (zone verticale de la ligne) et son style retirés, plus aucun appelant.
- Page voyage (`routes/trips/[id]/+page.svelte`) : imports, snippet `metroLegAfter`, branche `layout === 'metro'` et styles `.metro-*` retirés ; commentaires « trois affichages » corrigés (aussi dans `lib/trips/dayViews.ts`).
- `docs/specification.md` : description de l'affichage retirée, mention du retrait et de la compatibilité.

## Décisions et pourquoi

- **Compatibilité** : aucune migration du `localStorage`. `readLayout` ramène déjà toute valeur inconnue à `list` ; un appareil qui avait mémorisé `metro` retombe sur « Liste et carte » au chargement suivant. Un test unitaire le fixe.
- Les utilitaires utilisés par les composants supprimés (`legColorVar`, `contextMenuKey`, `legSourceLabel`, `GROUP_ICON`, `STAY_ICON`, `plural`, `dnd`) servent tous ailleurs : rien d'autre à retirer.

## Bugs et pièges rencontrés

- Rien de notable. Sur « Mon compte », d'autres boutons radio existent (thèmes) : l'e2e compte les affichages dans le groupe « Affichage de la journée », pas sur toute la page.

## Tests et vérifications

- Unitaires mis à jour d'abord et vus en échec (4 échecs) : `layout.test.ts` (deux affichages, ancienne valeur `metro` ramenée à `list`), `LayoutPicker.test.ts` (deux options, pas de « Ligne de métro »), `LayoutSwitch.test.ts` (deux boutons).
- E2E : `layouts.spec.ts` (le parcours « ligne de métro » est supprimé ; le premier parcours vérifie l'absence de l'affichage sur « Mon compte » et dans la page, puis part du « Plein écran »), `context-menu.spec.ts` (étapes et test sur les stations supprimés), `new-place.spec.ts` (boucle sur les deux affichages).
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (core 244, api 194, web 461), `pnpm build` : verts.
- `pnpm test:e2e` : 85 réussis, 7 en échec en parallèle (auth, menu contextuel, trajets, recherche, service worker, popup, glisser-déposer : délais sur machine chargée, piège connu) ; relancés avec `--last-failed --workers=1` : tous verts.

## Revue

- Auto-revue : aucun reste de code (références, CSS, testid, props), branche `{#if layout === 'list'} … {:else}` de la page toujours exacte (`LayoutId` vaut `'list' | 'board'`).
- Revue indépendante : 0 bloquant, 7 importants, 3 mineurs, tous dans la documentation ou les commentaires. Corrigés : sept mentions de la ligne de métro restées dans `docs/specification.md` comme si elle existait encore (dossiers, popup, survol, menu contextuel, actions au survol, timeline compacte, couleur des trajets) et le commentaire de `layout` dans la page voyage. Gardée volontairement : la mention datée du 24/11/2026 dans la décision « Glisser-déposer HTML5 natif » (historique).

## Reste à faire

Rien.
