# Choix du fond de carte par une liste, comme la maquette de référence

- Date : 2026-11-23
- Type : fonctionnalité (front)
- Issue : aucune (demande de l'utilisateur)

## Demande

Mettre le choix des fonds de carte comme sur le site de référence (`C:\MyDatas\Temp\game2`) : un
bouton qui ouvre une liste.

## Ce qui a été fait

- `lib/components/BasemapPicker.svelte` (nouveau) : bouton « Fond de carte » (icône calques,
  `aria-haspopup="menu"`) ; la liste « Choix du fond de carte » s'ouvre au-dessus de lui : Plan,
  Topo, Satellite en `menuitemradio`, fond courant coché et focalisé à l'ouverture. Flèches,
  Début, Fin, Échap (focus rendu au bouton), Tab et clic extérieur ferment.
- `TripMap.svelte` : le groupe Plan / Topo / Satellite quitte la pilule du haut ; le sélecteur est
  posé en bas à droite, au-dessus du zoom de MapLibre. La pilule (Explorer, Préparer hors ligne)
  n'est plus affichée quand elle serait vide ; son séparateur est retiré.
- `docs/specification.md` : description des outils de la carte.

## Décisions et pourquoi

- **Bas droite, liste au-dessus du bouton** : position et sens d'ouverture de la référence (sa
  barre de fond est aussi au-dessus du zoom).
- **Menu à boutons, pas `<select>`** : la référence ouvre une liste stylée ; motif clavier repris
  de `ProfileMenu` (même projet).
- **Choisir le fond courant** ne fait que fermer : `selectStyle` l'ignorait déjà.
- Libellés gardés (Plan, Topo, Satellite) : les fonds du projet, pas ceux de la référence.

## Bugs et pièges rencontrés

- Aucun.

## Tests et vérifications

- TDD : `BasemapPicker.test.ts` écrit avant le composant et vu en échec (composant absent) :
  fermé par défaut, ouverture et fond coché focalisé, choix (rappel, fermeture, focus), fond
  courant, clavier, clic extérieur et second clic. 6 tests.
- E2E : `e2e/map-styles.spec.ts` réécrit : plus de groupe en haut ; bouton en bas à droite de la
  carte (à moins de 40 px du bord droit, moitié basse) ; liste ouverte au-dessus du bouton ;
  Satellite charge l'imagerie Esri ; retour au Plan. Pas lancé avant le code (la suite complète
  demande un build) : l'ancien code n'avait pas de bouton « Fond de carte », il aurait échoué.
- `pnpm lint`, `pnpm typecheck` propres ; tests web : 318.
- `pnpm test:e2e --workers=2` (ports 8792/8802, build compris) : 54 sur 59 ; les 5 échecs
  (`legs`, `schedule`, `steps`) attendaient la création du voyage (délais, machine chargée).
  Relancés avec `--workers=1` avec `map-styles.spec` : 18 sur 18.

## Revue

- Rien de bloquant. Laissé : la largeur du champ de recherche (`calc(100% - 300px)`) tient
  encore compte de l'ancienne pilule plus large ; sans effet gênant.

## Reste à faire

- Rien.
