---
name: project-plan
description: Prépare avec l'utilisateur un plan d'implémentation pour une tâche de ce projet, sans rien coder. Accepte une demande libre, un numéro d'issue GitHub ou un lien d'issue. Analyse la demande avec tout le contexte connu de la skill project-execute, lève les doutes en proposant des solutions au choix, puis reformule et complète l'issue avec le plan (ou propose de la créer), et propose enfin de lancer project-execute sur cette issue. Utiliser quand l'utilisateur veut d'abord un plan, pas une implémentation directe.
---

# Plan

Cette skill construit **avec l'utilisateur** un plan d'implémentation concret, **sans rien implémenter**. Le plan validé est enregistré dans une issue GitHub, qui sert d'entrée à `project-execute`.

Déroulé : **Entrée → Contexte → Analyse → Plan et doutes (itératif) → Validation → Issue GitHub → Proposer l'exécution**.

## Règle absolue : lecture seule

Tant que la skill tourne, **ne rien modifier dans le dépôt** : ni code, ni test, ni documentation, ni fiche `docs/tasks/`, ni branche, ni commit, ni dépendance. Seule écriture permise : sur GitHub, l'issue du plan (étape 6), après accord de l'utilisateur.

Ne pas passer en mode plan (`EnterPlanMode` / `ExitPlanMode`) : la validation se fait par des questions, et la fin de la skill doit pouvoir écrire l'issue puis lancer `project-execute`.

## Modèles, effort et délégation

Appliquer **[`../project-execute/references/modeles.md`](../project-execute/references/modeles.md)** à toutes les étapes ; le lire au lancement s'il n'est pas déjà dans la conversation. Les codes entre crochets (ex. [E1]) renvoient à ses catégories de travail. Contrôler dès le lancement le modèle de la session, comme indiqué dans ce fichier. Tout brief de sous-agent rappelle la règle de lecture seule.

## 1. Entrée

Dans les arguments ou la demande :

- **une demande libre** (correction, fonctionnalité, évolution) ;
- **un numéro d'issue** : `#12`, `12`, « issue 12 », « ticket 12 » ;
- **un lien d'issue** : `https://github.com/<owner>/<repo>/issues/12`.

Pour une issue :

1. Owner, repo et numéro : depuis l'URL pour un lien, sinon via `git remote get-url origin`. Autre dépôt que celui du projet : le signaler et demander confirmation.
2. Lire l'issue et tous ses commentaires [G2] (`issue_read`) : c'est la demande à planifier. Noter ses labels, son titre et un éventuel plan déjà présent (à reprendre plutôt qu'à ignorer).
3. Issue fermée : demander s'il faut continuer (et la rouvrir à la fin) ou s'arrêter.
4. **Ne pas changer son statut** : le passage à « In Progress » est fait par `project-execute`.

Entrée vide ou trop vague : demander de préciser avant d'aller plus loin.

## 2. Contexte

Ne pas lire ni invoquer `project-execute` : l'invoquer déclencherait ses actions (statut de l'issue, choix de branche). Charger directement le contexte du projet, par lectures ciblées :

- `docs/specification.md`, par sections : limites connues, reste à faire, décisions d'architecture, et les parties touchées par la demande ;
- `docs/tasks/` : la ou les fiches les plus récentes, et les pièges connus de la zone concernée par mots-clés [E2] ;
- `CLAUDE.md` : conventions et pièges des fichiers qui seront touchés ;
- `README.md` et la configuration du projet (scripts, outillage de test, build).

Le plan doit pouvoir être exécuté tel quel par `project-execute`, qui impose :

- **TDD** : tests unitaires et e2e écrits et vus en échec avant le code ; si l'outillage manque, une décision sur sa mise en place ;
- **vérifications** : suites unitaires et e2e complètes, build de production (typecheck, lint), vérification dans l'application réelle pour un changement visible ;
- **revue finale** du diff (auto-revue puis revue indépendante par un sous-agent relecteur : bugs, régressions, conventions, sécurité, performance), avec correction des points relevés ;
- **documentation** : fiche `docs/tasks/` toujours, `docs/specification.md`, `README.md` et `CLAUDE.md` si besoin ;
- **périmètre strict**, compatibilité avec l'existant, pas de dépendance sans nécessité ; branche ou worktree choisi par l'utilisateur au moment de l'exécution.

## 3. Analyse

Explorer le code concerné [E1] puis lire les extraits utiles [R1], pour que le plan repose sur l'existant réel :

- fichiers, fonctions et composants concernés, et leurs appelants ;
- utilitaires existants à réutiliser ;
- décisions déjà prises (spécification, `docs/tasks/`) qui contraignent l'approche ;
- pour un bug : cause racine probable, et comment la reproduire dans un test ;
- risques de régression : autres modes, écrans, formats ou données, build de production ;
- hors périmètre.

Relever au passage tous les **points de doute** : comportement attendu flou, plusieurs approches, compromis (simplicité, performance, compatibilité), dépendance à ajouter, outillage de test absent, impact sur la documentation ou les formats.

## 4. Plan et doutes (itératif)

1. **Présenter un premier plan** (format ci-dessous) avec les points encore ouverts.
2. **Lever chaque doute avec `AskUserQuestion`**, par des solutions concrètes plutôt qu'une question ouverte :
   - 2 à 4 options, la recommandée en premier avec « (Recommandé) » dans son libellé ;
   - pour chaque option, sa conséquence (effort, risque, compatibilité) dans la description ;
   - doutes indépendants groupés dans un même appel (jusqu'à 4 questions) ;
   - réponse « Other » (autre solution ou question) : y répondre ou analyser la solution (faisabilité, conséquences, en relisant le code si besoin), puis reposer la question si le point reste ouvert.
3. **Mettre à jour le plan** avec chaque décision ; ne le représenter que s'il a changé de façon notable.
4. Recommencer tant qu'il reste des doutes qui changent l'implémentation. Un choix à réponse conventionnelle évidente : le trancher et l'indiquer dans le plan.

L'utilisateur peut à tout moment poser une question ou demander un changement : répondre, ajuster, reprendre où on en était.

### Format du plan

```markdown
## Objectif
Ce qui doit être obtenu, en une ou deux phrases (pour un bug : comportement actuel, comportement attendu).

## Contexte
Éléments de la spécification, des `docs/tasks/` et du code qui comptent pour cette tâche ; pièges connus.

## Décisions
Chaque point tranché avec l'utilisateur : choix retenu et pourquoi (alternatives écartées).

## Tests à écrire d'abord (TDD)
- Unitaires : cas nominaux, cas limites, compatibilité (fichier de test prévu).
- End-to-end : parcours utilisateur concernés.
- Outillage de test à mettre en place si absent (décision prise).

## Étapes
1. Étape concrète — fichiers à créer ou modifier (`chemin`), ce qui change.
2. …

## Vérifications
Suites de tests, build, vérifications manuelles (formats d'écran, modes) prévues.

## Documentation
Mises à jour prévues : `docs/specification.md`, `README.md`, `CLAUDE.md`, fiche `docs/tasks/`.

## Risques et points d'attention
Régressions possibles, zones sensibles ; points de sécurité (entrées externes, autorisations, données sensibles, dépendances) et de performance (boucles, rendu, chargement, mobile) à surveiller à la revue.

## Hors périmètre
Ce qui ne sera pas fait dans cette tâche.
```

## 5. Validation

Sans doute restant, présenter le **plan complet final**, puis demander la validation (`AskUserQuestion`) :

- **Valider le plan** : passer à l'étape 6.
- **Modifier le plan** : l'utilisateur précise le changement (« Other » ou réponse suivante) ; ajuster et redemander.
- **Poser une question** : y répondre, puis redemander.

Ne continuer qu'après une validation explicite.

## 6. Issue GitHub

Écritures en direct [G3] : le titre et le corps sont déjà rédigés.

### Si une issue était référencée : la reformuler et la compléter

1. Préparer le **nouveau titre** (court, précis) et le **nouveau corps** [R5] :

   ```markdown
   ## Description
   La demande reformulée clairement, avec les précisions apportées dans les commentaires et pendant la planification.

   ## Plan
   Le plan validé (format ci-dessus, à partir de « Objectif »).

   <details>
   <summary>Description d'origine</summary>

   Le texte d'origine de l'issue, tel quel.

   </details>
   ```

   Toujours garder la description d'origine dans la section repliable : rien de ce qu'a écrit l'auteur ne doit être perdu.
2. Montrer titre et corps, puis demander confirmation (`AskUserQuestion` : « Mettre à jour l'issue » / « Modifier le texte » / « Ne pas mettre à jour »).
3. Après accord, `issue_write` (titre et corps). Ne toucher ni au statut, ni à l'assignation, ni aux labels. Si elle était fermée et que l'utilisateur a demandé de continuer, la rouvrir.
4. Relire l'issue pour vérifier, et le confirmer en une ligne avec le lien.

### Si aucune issue n'était référencée : proposer de la créer

1. Préparer un **titre** et un **corps** sur le même modèle (« Description » et « Plan », sans « Description d'origine »).
2. Proposer la création (`AskUserQuestion` : « Créer l'issue » / « Modifier le texte » / « Ne pas créer »).
3. Après accord, `issue_write` sur le dépôt de `git remote get-url origin`. Appliquer le label de type existant qui correspond (ex. `bug`, `enhancement`) ; ne pas en créer.
4. Donner le numéro et le lien de l'issue créée.

Échec d'écriture (droits, outil indisponible) : donner la cause sans prétendre que l'issue a été modifiée ou créée, et fournir le titre et le corps en texte à coller.

## 7. Proposer l'exécution

Terminer en proposant de lancer l'implémentation (`AskUserQuestion`) :

- **Lancer `project-execute` avec l'issue `#NN`** (recommandé quand une issue porte le plan) : `Skill`, `skill: "project-execute"`, `args: "#NN"`. Elle passera l'issue en « In Progress » et suivra le plan ; le contexte déjà chargé ici ne sera pas relu.
- **Lancer `project-execute` sans issue** (si l'utilisateur n'en a pas voulu) : l'invoquer avec le plan validé, qui reste dans la conversation.
- **Plus tard** : ne rien lancer. Rappeler que le plan est dans l'issue `#NN` (sans issue, donner le plan complet pour qu'il ne soit pas perdu) et qu'il suffira de lancer `project-execute #NN`.
