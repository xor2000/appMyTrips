# En-tête réduit, choix du voyage dans l'en-tête et design de la référence

- Date : 2026-11-23
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur)

## Demande

Réduire l'en-tête en s'inspirant du projet de référence `C:\MyDatas\Temp\game2` (« Escale ») :
plus de page d'accueil des voyages ; après le nom de l'application, une liste déroulante pour
choisir le voyage, une roue crantée pour ses paramètres et « + » pour en créer un ; les jours sur
la même ligne, après la liste. Reprendre le design des fenêtres (fond flouté), des boutons et la
police.

Choix de l'utilisateur (questions posées avant de coder) :

- « / » ouvre le dernier voyage consulté (sinon en cours / prochain / plus récent) ; cartes photo,
  voyage mis en avant et photo automatique supprimés ; le choix de photo reste dans « Modifier le
  voyage » sans être affiché ailleurs ;
- roue crantée = fenêtre « Modifier le voyage » avec « Supprimer le voyage » (propriétaire) ;
  « Partager » devient un bouton icône ;
- Manrope partout, JetBrains Mono gardée pour les horaires ;
- travail sur la branche courante.

## Ce qui a été fait

- `lib/components/AppHeader.svelte` : une ligne de 56 px, logo + nom « MyTrips », emplacement
  `trips` (choix du voyage), contenu de la page, bouton d'installation, profil.
- `lib/components/TripSwitcher.svelte` (nouveau) : pilule à filet avec `<select>` natif
  « Choisir un voyage » (groupes « En cours et à venir » / « Souvenirs », `groupTrips`), roue
  crantée « Paramètres du voyage » et « + » « Nouveau voyage », chacun seulement si l'action est
  possible.
- `lib/trips/tripList.svelte.ts` (nouveau) : liste des voyages partagée (chargement avec copie hors
  ligne, `upsertTrip`, `removeTrip`, `resetTripList`, garde contre un chargement périmé) et
  indicateur `creating` de la fenêtre de création.
- `routes/+layout.svelte` : charge la liste quand la session est connue (ou la copie hors ligne),
  la recharge au retour du réseau, câble `TripSwitcher` et ouvre la fenêtre « Nouveau voyage ».
- `routes/+page.svelte` : redirection vers `pickStartTrip` (`lib/home.ts` : dernier voyage
  `mytrips.lastTrip`, sinon en cours / prochain, sinon souvenir le plus récent), sinon écran
  « Aucun voyage pour l'instant ».
- Page voyage : jours (`DayTabs`, période sous « Tout le voyage »), « Lecture seule », affichage,
  annuler, rétablir et « Partager » (icône) dans l'en-tête ; roue crantée posée par
  `pageHeader.settings` ; suppression du voyage depuis ses paramètres (confirmation, puis « / ») ;
  `<h1>` du nom réservé aux lecteurs d'écran ; liste de l'en-tête tenue à jour ; dernier voyage
  mémorisé, oublié et retiré de la liste sur un 404.
- `Modal.svelte` : fond `--scrim` flouté, panneau 18 px à `--shadow-modal` (nouvelle variable des
  thèmes), en-tête titre + croix « Fermer la fenêtre », actions à droite ; focus jamais sur la croix.
- `controls.css` : boutons de la référence (Manrope 700, 13 px, 36 px, coins 10 px), `btn-ghost` à
  filet, `btn-danger-ghost`, `icon-btn`, `visually-hidden` global. `--btn-radius` à 10 px en Pastel.
- Police Manrope (`@fontsource-variable/manrope` 5.3.0) à la place d'Outfit et d'Inter (retirées),
  corps à 14 px.
- `InstallPrompt` : bouton icône de l'en-tête.
- Supprimés : `NextTrip`, `TripCard`, `lib/covers.ts`, `lib/trips/tint.ts`, `countdownLabel`,
  `tripDayNumber` (et leurs tests).

## Décisions et pourquoi

- **`<select>` natif** comme la référence : accessible et utilisable au clavier sans code de menu ;
  les groupes reprennent le classement de l'ancien accueil.
- **Fenêtre de création dans le layout** (et non dans la page) : « + » est dans l'en-tête de toutes
  les pages, et la fenêtre survit à la redirection de « / ».
- **Roue crantée posée par la page** (`pageHeader.settings`) : seule la page voyage sait si
  l'utilisateur peut modifier ; hors d'un voyage, pas de roue.
- **Nom du voyage en `<h1>` masqué** : la page garde un titre pour les lecteurs d'écran, et les e2e
  existants l'utilisent toujours.
- **Période sous « Tout le voyage »** : les dates du voyage restent visibles sans ligne de titre.
- **Mise à jour de la liste par `$effect` + `untrack`** sur l'instantané du voyage : un seul point
  pour toutes les écritures ; `untrack` évite que l'effet dépende de la liste qu'il modifie
  (boucle).

## Bugs et pièges rencontrés

- La croix « Fermer la fenêtre » rend ambigu `getByRole('button', { name: 'Fermer' })` dans les
  e2e (recherche partielle) : `exact: true` (noté dans `CLAUDE.md`).
- **Dernier voyage mémorisé trop tard** : enregistré d'abord après le chargement du voyage ; en
  revenant vite sur « / » (e2e), le voyage précédent était rouvert. Mémorisé maintenant dès
  l'ouverture (changement d'`id`), oublié sur un 404.
- **Jours écrasés en tablette** (768 px) : sur la même ligne que la liste et les actions, les
  onglets tombaient à quelques pixels. `toBeVisible` ne le voyait pas (onglet de largeur non
  nulle) : l'e2e tablette vérifie la position et la largeur. Sous 1024 px, les jours passent sur
  une seconde ligne.
- **Session expirée** : la liste de l'ancien compte restait en mémoire ; `toLogin` la vide.
- Un heredoc bash contenant des apostrophes françaises a échoué : passer par un script Python
  écrit dans le dossier temporaire.

## Tests et vérifications

- TDD, vus en échec avant le code : `home.test.ts` (`pickStartTrip`, dernier voyage),
  `TripSwitcher.test.ts` (5 cas), `AppHeader.test.ts` (nom, ordre), `Modal.test.ts` (croix, focus,
  Échap), `TripFormDialog.test.ts` (« Supprimer le voyage »), `DayTabs.test.ts` (période),
  `tripList.test.ts` (chargement, erreur, mise à jour, chargement périmé, remise à zéro).
- E2E : `header.spec.ts` réécrit (nom de l'appli, une ligne ≤ 64 px dans l'ordre nom / liste /
  roue / + / jours, Manrope, changement de voyage, fenêtre floutée et croix, tablette 768 px),
  `home.spec.ts` réécrit (« / » rouvre le dernier voyage, écran sans voyage, photo depuis les
  paramètres), `trips.spec.ts`, `offline.spec.ts` et `auth.spec.ts` adaptés. « sans voyage » passait
  déjà avant le code (comportement conservé, gardé comme garde-fou).
- `pnpm lint`, `pnpm typecheck` propres ; `pnpm test` : core 234, API 187, web 312 ;
  `pnpm build` OK ; `pnpm test:e2e --workers=2` (ports 8791/8801) : 59 sur 59.
- Captures (build servi par `wrangler dev`) : 1280 px (une ligne de 56 px, fenêtre « Modifier le
  voyage » floutée), 768 px (jours en seconde ligne après correction), 375 px (pas de débordement
  horizontal).

## Revue

- Corrigés : liste non vidée sur session expirée (`+layout.svelte`, `toLogin`) ; dernier voyage
  mémorisé trop tard ; jours écrasés en tablette ; variables `--photo-*` des thèmes devenues
  inutiles retirées ; code mort de l'accueil supprimé (`countdownLabel`, `tripDayNumber`, teinte).
- Laissés : le lien « Mes voyages » de la page d'invitation mène à « / », donc au dernier voyage
  (libellé acceptable) ; sur téléphone l'en-tête tient sur trois lignes (hors cible : desktop et
  tablette uniquement, consigne ajoutée à la spécification et à `CLAUDE.md`).

## Reste à faire

- La photo de couverture n'est plus affichée nulle part : la retirer complètement (API, cache) ou
  lui redonner une place, selon l'usage.
