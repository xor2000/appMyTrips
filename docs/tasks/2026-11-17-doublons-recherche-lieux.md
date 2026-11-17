# Page « 500 » pendant la recherche d'un lieu

- Date : 2026-11-17
- Type : correction
- Issue : aucune (signalé en production par l'utilisateur)

## Demande

En production, la recherche d'un lieu pour une étape affichait la page d'erreur « 500 Internal Error »
dès la 3ᵉ lettre.

## Ce qui a été fait

- `apps/web/src/lib/components/steps/PlaceSearch.svelte` : la liste des résultats est indexée par
  position, et non plus par `${osmRef}-${lat}-${lng}`.
- `apps/api/src/routes/geocode.ts` : les résultats de Photon sont dédoublonnés (un lieu par objet OSM,
  ou par nom et point sans référence OSM).

## Décisions et pourquoi

- Correction des deux côtés : l'API ne renvoie plus de doublon (liste plus propre), et le front ne
  plante plus si une source en renvoie quand même.

## Bugs et pièges rencontrés

- **Cause racine** : Photon renvoie parfois deux fois le même lieu. La clé du `{#each}` était alors en
  double, Svelte lève `each_key_duplicate` au rendu, et SvelteKit remplace la page par sa page
  d'erreur 500. L'API répondait 200 (vérifié avec `wrangler tail`) : l'erreur était côté navigateur.
- Les données factices des tests et des e2e n'avaient jamais de doublon.
- Piège général : une clé de `{#each}` construite à partir de données externes ne doit pas supposer
  qu'elles sont uniques.
- Le message de console « The script has an unsupported MIME type ('text/html') » vu en même temps
  vient d'un ancien fichier demandé par le service worker après un déploiement (le Worker renvoie
  alors la page SPA) ; il disparaît après « Recharger » sur l'invite de mise à jour.

## Tests et vérifications

- TDD : `PlaceSearch.test.ts` (résultats en double affichés sans planter) et `geocode.test.ts`
  (dédoublonnage), vus en échec (`each_key_duplicate`, 4 résultats au lieu de 2) puis au vert.
- Suites : web 217, API 171 ; lint et typecheck propres ; e2e `steps` et `poi` (11) au vert.

## Revue

Seule autre liste indexée par une clé construite (`{#each … (`…`)}`) : aucune.

## Reste à faire

Déployer, puis vérifier la recherche en production.
