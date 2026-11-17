# Rapprochement visuel avec la maquette de l'étude

- Date : 2026-11-17
- Type : design (front)
- Issue : aucune (demande de l'utilisateur : interface trop éloignée de la maquette « MyTrips — étude »)

## Demande

Rapprocher l'application web de la maquette de l'étude initiale (direction C « Pastel ludique ») pour
les couleurs et la disposition. Les écarts ont été présentés dans un artifact (« MyTrips ·
rapprochement maquette ») ; l'utilisateur a retenu :

- 0 : palette et typographie ;
- 2 : panneau du jour ;
- 3 : timeline, **en gardant l'encart de trajet tel quel** (seule la palette change) ;
- 4 : outils de la carte.

Le point 1 (en-tête du voyage sur une ligne, onglets à droite) n'a pas été retenu.

## Ce qui a été fait

- `lib/styles/tokens.css` : palette de la maquette (neutres vert d'eau, accent sarcelle, couleurs
  par type), thèmes clair et sombre ; nouveaux tokens `--on-type`, `--on-warn`, `--on-bad`,
  `--marker-ring`, `--shadow-marker`, `--shadow-window`, `--scrim`, `--radius-xl` ; rayons 12 / 18 px.
  Les dernières couleurs en dur (`#fff`, voile des fenêtres, ombres des marqueurs) passent par ces
  tokens.
- Police JetBrains Mono (`@fontsource-variable/jetbrains-mono` 5.3.0) pour `--font-mono`.
- Panneau gauche (`SplitPane`, page voyage) : fond `--surface`, poignée réduite à un filet d'1 px
  visible ; en-tête du jour séparé par un filet, heures avec la durée (`format.dayHoursLabel`).
- `DaySummary` : couleurs de la maquette (sur place sarcelle, trajets orange, libre vert,
  dépassement rouge), légende chiffrée (`data-testid="day-legend"`), bouton « Réorganiser » plein
  orange.
- Timeline (`Timeline`, `StepCard`, `GroupCard`, séjours) : colonne d'heures de 44 px
  (`timeColumn`), rail pointillé, pastilles à côté du nom, actions en surimpression au survol. Les
  trajets gardent leur pilule, alignée sur le rail via `--leg-indent`.
- Ajout : bouton pointillé « + Ajouter un lieu », séjour / dossier / GPX en petits boutons.
- `TripMap` : une pilule d'outils (Plan, Topo, Explorer, Préparer hors ligne) ; champ flottant
  « Rechercher un lieu, une adresse… » (`onSearch`) qui ouvre « Ajouter un lieu » (« Ajouter une
  idée » sur « Tout le voyage »). Le bouton hors ligne quitte l'en-tête du voyage.

## Décisions et pourquoi

- **Horaire complet dans la carte** : la colonne de gauche n'affiche que l'heure de début
  (`aria-hidden`). Les e2e et le nom accessible (« nom type… ») lisent l'horaire et le type dans
  la carte : l'ordre du DOM ne change pas, seule la mise en page (flex `order`) place les pastilles
  à côté du nom.
- **Actions en surimpression** : la colonne d'actions invisible prenait 30 px et faisait passer
  l'horaire à la ligne dans un panneau de 420 px.
- **Libellés inchangés** (« Ajouter un lieu », « Explorer », « Préparer hors ligne »…) : les e2e
  sélectionnent par rôle et libellé. Le champ de recherche ne contient pas « Ajouter un lieu »
  (`getByRole` cherche une sous-chaîne).
- **DropZone** : hauteur inchangée, seulement décalée à gauche pour s'aligner sur les cartes.

## Bugs et pièges rencontrés

- **Écritures impossibles sous `vite dev`** : le proxy Vite relaie `/api` vers `wrangler dev`, qui
  réécrit l'en-tête `Host` ; `sameOrigin()` compare alors l'origine `localhost:5173` à
  `localhost:8787` et répond `403 bad_origin`. Lecture possible, écriture impossible depuis le front
  de dev. Contourné pour la vérification en créant les données depuis le Worker (même origine).
  Non corrigé ici (hors périmètre).
- Le captcha d'inscription n'a pas été résolu à la main : compte et session de test insérés dans la
  base D1 locale.

## Tests et vérifications

- TDD : `format.test.ts` (`dayHoursLabel`), `DaySummary.test.ts` (légende), `StepCard.test.ts`
  (colonne d'heures présente ou absente), vus en échec puis au vert.
- Contrôle visuel dans le navigateur, thèmes clair et sombre, fenêtre 1280 × 900.
- `pnpm lint` et `pnpm typecheck` propres ; `pnpm test` : core 220, API 171, web 222 ;
  `pnpm test:e2e` (build compris) : 38 sur 39 au premier passage, l'échec étant l'activation du
  service worker dans `smoke` (délai de 20 s dépassé, machine chargée) ; `smoke.spec.ts` relancé
  seul avec `--workers=1` : 7 sur 7.

## Reste à faire

- Point 1 (en-tête sur une ligne) si l'utilisateur le souhaite plus tard.
- Corriger `bad_origin` sous `vite dev` (par exemple `changeOrigin` côté proxy, ou comparer à
  `X-Forwarded-Host`).
