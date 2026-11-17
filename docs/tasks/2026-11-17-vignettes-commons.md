# Photos introuvables dans « Changer la photo »

- Date : 2026-11-17
- Type : correction
- Issue : aucune (signalé par l'utilisateur après le déploiement de l'accueil illustré)

## Demande

En modifiant un voyage, la recherche de photo n'affichait que des images cassées.

## Ce qui a été fait

- `packages/core/src/cover/cover.ts` : vignettes en **500 px** (`fixCoverThumb`) au lieu de
  640 px ; photos d'au moins **1280 px** de large (au lieu de 1000).
- `apps/api/src/db/trips.ts` : une vignette 640 px déjà enregistrée sur un voyage est corrigée à
  la lecture.
- `apps/api/src/routes/covers.ts` : clé de cache versionnée (`v2:`), qui écarte les recherches
  enregistrées avant la correction.

## Décisions et pourquoi

- 500 px : largeur standard la plus proche de la taille des cartes (vérifié : 330, 500, 960 et
  1280 px répondent 200 ; 640, 800 et 1024 px répondent 400).
- Versionner la clé du cache plutôt que réécrire son contenu : plus simple, et les anciennes
  entrées contenaient aussi des images de moins de 1280 px.

## Bugs et pièges rencontrés

- **Cause racine** : Wikimedia ne sert plus que des largeurs de vignette standard ; la vignette
  640 px, déduite de l'URL 1280 px, répondait `400`. Les tests (données factices) et l'e2e (images
  du service factice) ne pouvaient pas le voir ; le contrôle sur l'API réelle n'avait vérifié que
  la grande image.
- Une image de moins de 1280 px : Commons renvoie l'original au lieu d'une vignette, et
  `upload.wikimedia.org` le limite (`429`).
- Piège général : avec Commons, ne demander que des largeurs standard et tester les adresses
  réelles renvoyées, pas seulement la réponse JSON.

## Tests et vérifications

- TDD, vus en échec puis au vert : `cover.test.ts` (vignette 500 px, correction d'une 640 px,
  image de 1100 px écartée) ; `covers.test.ts` (vignette corrigée à la lecture du voyage).
- Écrit avec la correction : test du cache ignoré (`v2:`).
- Sur l'API réelle (recherche « Lisbonne » par le serveur local) : 8 vignettes et 8 grandes
  images, toutes en `200`.
- Suites : voir le compte rendu de la session.

## Reste à faire

- Un voyage dont la photo enregistrée est un original de moins de 1280 px peut encore avoir une
  grande image qui ne charge pas : elle est masquée (teinte du voyage), « Changer la photo » y
  remédie.
