# Taille d'affichage, timeline compacte et trajets facultatifs

- Date : 2026-11-24
- Type : fonctionnalité (front et moteur d'horaires)
- Issue : aucune (demande de l'utilisateur)

## Demande

1. Dans le menu du profil, passer le zoom à 80 / 90 / 100 % avec des boutons, comme l'application
   appMyBank.
2. Proposer des solutions pour réduire la hauteur de la timeline (trajets, espaces…).
3. Nouvelle règle : les trajets ne sont plus obligatoires entre les lieux.

## Ce qui a été fait

- **Taille d'affichage** (reprise d'appMyBank, `web/src/scale.svelte.ts` et `UserMenu.svelte`) :
  `lib/scale.svelte.ts` (80, 90, 100 %, clé `mytrips.scale`, 100 % par défaut), script de
  `app.html` (appliquée avant le premier affichage), `global.css` (`zoom: var(--zoom)` sur
  `<html>`, hauteur divisée par le zoom), segments « Taille d'affichage » dans `ProfileMenu`
  (le menu reste ouvert pour comparer).
- **Timeline compacte** (les quatre solutions retenues par l'utilisateur) :
  - `LegTile` : trajet en ligne fine de 22 px ; sans trajet, interstice de 10 px et « + trajet »
    en surimpression au survol (ou au clavier), toujours affiché s'il y a un trajet à reprendre ;
    rien en lecture seule ;
  - `StepCard` : carte sur une ligne (icône 28 px, nom, type et durée, pastilles, horaire
    « début → fin ») ; actions de survol en ligne ;
  - espacements : `DropZone` 8 px (et `--leg-offset`), `.block` 8 px, temps libre et boutons
    d'ajout plus bas.
- **Trajets facultatifs** : `core/schedule` ne produit plus l'issue `missing_leg` ni
  `summary.missingLegs` ; `DaySummary` n'affiche plus « N trajets manquants » ; `MetroLeg` en
  lecture seule ne montre plus « ? » ni « Trajet à définir ».

## Décisions et pourquoi

- **100 % par défaut** (choix de l'utilisateur ; appMyBank est à 80 %) : rien ne change sans choix.
- **Zoom CSS sur `<html>`** comme appMyBank : MapLibre reste juste (clic sur la carte vérifié en e2e
  à 80 %) ; seuls les tests convertissent la projection de la carte en pixels d'écran.
- **« + trajet » en surimpression** plutôt que dans le flux : afficher la barre au survol ne doit
  pas décaler la liste (même raison que la hauteur fixe des zones de dépôt). Barre masquée avec
  `pointer-events: none` : un clic sur le bord d'une carte ne crée jamais de trajet par mégarde.
- **Zones de dépôt de 8 px** (au lieu de 12) : encore assez hautes pour viser un dépôt (e2e de
  glisser-déposer verts).
- **Ligne de métro** : seule la lecture seule change (plus d'alerte « ? ») ; son « + » est déjà
  compact.

## Bugs et pièges rencontrés

- Les e2e qui créaient un trajet par la tuile vide survolent maintenant la tuile d'abord (barre
  masquée et sans `pointer-events` hors survol) : noté dans `CLAUDE.md`.
- `clickMapAt` (e2e de la découverte) tient compte du zoom CSS : position = boîte du canevas +
  projection × (largeur affichée / `offsetWidth`).

## Tests et vérifications

- TDD, vus en échec avant le code : `lib/scale.test.ts` (6 cas), `ProfileMenu.test.ts`
  (segments, 100 % par défaut, choix appliqué et gardé, menu ouvert), `schedule.test.ts` (sans
  trajet : 0 min, aucune issue, plus de `missingLegs`), `DaySummary.test.ts`, `LegTile.test.ts`
  (lecture seule vide, barre repliée, affichée avec un trajet à reprendre), `MetroLeg.test.ts`.
- E2E : `header.spec.ts` (80 % appliqué, gardé au rechargement, retour à 100 %), `poi.spec.ts`
  (clic sur la carte à 80 % : bon lieu), `legs.spec.ts` (pas d'alerte, carte ≤ 48 px, interstice
  ≤ 24 px, barre masquée puis visible au survol sans décalage, trajet ≤ 26 px).
- `pnpm lint`, `pnpm typecheck` propres ; `pnpm test` : core 234, API 195, web 343 ;
  `pnpm test:e2e --workers=2` : 67 sur 68 (assertion d'opacité sur le mauvais élément, corrigée),
  puis après les dernières retouches 67 sur 68 (inscription d'`auth.spec`, sans rapport, verte
  relancée seule : 6 sur 6).
- Captures (1280 px) : timeline à trois étapes (carte d'une ligne, trajet fin, barre d'ajout au
  survol) ; menu du profil à 80 %.

## Revue

- Corrigé : le nom de l'étape se raccourcissait avant le type (« Musée du Louv… ») : le type cède
  maintenant sa place d'abord.

## Reste à faire

- Rien.
