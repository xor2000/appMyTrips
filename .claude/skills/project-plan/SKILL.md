---
name: project-plan
description: Prépare avec l'utilisateur un plan d'implémentation pour une tâche de ce projet, sans rien coder. Accepte une demande libre, un numéro d'issue GitHub ou un lien d'issue. Analyse la demande avec tout le contexte connu de la skill project-execute, lève les doutes en proposant des solutions au choix, puis reformule et complète l'issue avec le plan (ou propose de la créer), et propose enfin de lancer project-execute sur cette issue. Utiliser quand l'utilisateur veut d'abord un plan, pas une implémentation directe.
---

# Plan

Cette skill construit **avec l'utilisateur** un plan d'implémentation concret pour une tâche de ce projet, **sans rien implémenter**. Le plan validé est enregistré dans une issue GitHub, qui sert ensuite d'entrée à la skill `project-execute`.

Déroulé : **Entrée → Contexte → Analyse → Plan et doutes (itératif) → Validation → Issue GitHub → Proposer l'exécution**.

## Règle absolue : lecture seule

Tant que la skill tourne, **ne rien modifier dans le dépôt** : ni code, ni test, ni documentation, ni fiche `docs/tasks/`, ni branche, ni commit, ni installation de dépendance. Seules écritures permises : sur GitHub, l'issue du plan (étape « Issue GitHub »), après accord de l'utilisateur.

Ne pas passer en mode plan (`EnterPlanMode` / `ExitPlanMode`) : la validation se fait par des questions à l'utilisateur, et la fin de la skill doit pouvoir écrire l'issue GitHub puis lancer `project-execute`.

## Choix du modèle selon le type de tâche

Cette règle s'applique à toutes les étapes de la skill.

- **Tâches de type script** : exécution de commandes sans réflexion de fond, comme les commandes `git` (`remote`, `status`, `log`, `branch`), les commandes PowerShell ou shell, et les opérations GitHub (outils MCP `github`, CLI `gh` : lecture des issues et commentaires, mise à jour ou création de l'issue avec un titre et un corps déjà rédigés et validés). L'agent **peut** les confier à un modèle plus bas, via un sous-agent (`Agent`) avec `model: "sonnet"` et `effort: "high"`, ou `model: "opus"` et `effort: "medium"`.
  - Le brief du sous-agent donne les opérations exactes (commandes, valeurs, textes déjà rédigés) et le retour attendu (sortie brute, état vérifié), et rappelle la règle de lecture seule ci-dessus. Le sous-agent n'analyse pas et ne décide rien : sur un résultat inattendu (erreur, droit insuffisant, issue fermée), il s'arrête et le rapporte à l'agent principal, qui décide de la suite.
  - Pour une commande unique et courte, l'exécuter directement reste possible : la délégation coûte un aller-retour.
- **Toutes les autres tâches** : analyse de la demande et du code, conception, design, élaboration du plan, formulation des doutes et des options, rédaction du titre et du corps de l'issue. Elles se font **toujours avec Opus en effort high** : par l'agent principal, ou par un sous-agent lancé avec `model: "opus"` et `effort: "high"`, jamais avec un modèle plus bas.
- Une skill ne peut pas changer le modèle de la session. Si la session ne tourne pas sur Opus (ou si son effort connu est inférieur à high), le signaler à l'utilisateur en une ligne dès le lancement et lui proposer de changer de modèle ou d'effort avant l'analyse.

## 1. Entrée

La skill reçoit l'une de ces entrées, dans ses arguments ou dans la demande de l'utilisateur :

- **une demande libre** (correction, fonctionnalité, évolution) ;
- **un numéro d'issue** : `#12`, `12`, « issue 12 », « l'issue n°12 », « ticket 12 » ;
- **un lien d'issue** : `https://github.com/<owner>/<repo>/issues/12`.

Pour une issue :

1. Identifier owner, repo et numéro : depuis l'URL pour un lien, sinon via `git remote get-url origin`. Si le lien désigne un autre dépôt que celui du projet, le signaler et demander confirmation.
2. Lire l'issue et tous ses commentaires (`issue_read`). C'est la demande à planifier, avec les précisions apportées dans les commentaires. Noter aussi ses labels, son titre et un éventuel plan déjà présent (plan précédent à reprendre plutôt qu'à ignorer).
3. Si l'issue est fermée, demander à l'utilisateur s'il faut continuer (et la rouvrir à la fin) ou s'arrêter.
4. **Ne pas changer le statut de l'issue** : le passage à « In Progress » est fait par `project-execute` au moment de l'exécution, pas pendant la planification.

Si l'entrée est vide ou trop vague pour être analysée, demander à l'utilisateur de préciser avant d'aller plus loin.

## 2. Contexte : tout ce que connaît `project-execute`

Lire **[`.claude/skills/project-execute/SKILL.md`](../project-execute/SKILL.md)** avec l'outil de lecture, **sans invoquer la skill** : l'invoquer déclencherait ses actions (passage de l'issue en « In Progress », proposition de branche), qui n'ont pas lieu d'être pendant la planification.

Appliquer ensuite ses lectures de contexte (section « Avant de commencer ») :

- `docs/specification.md`, en particulier les limites connues, le reste à faire et les décisions d'architecture ;
- les entrées récentes de `docs/tasks/` et celles qui touchent la zone concernée (recherche par mots-clés) ;
- les conventions et pièges de `CLAUDE.md` pour les fichiers qui seront touchés ;
- `README.md` et la configuration du projet (scripts, outillage de test, build).

Le plan doit respecter **toutes les règles de `project-execute`**, pour pouvoir être exécuté tel quel : TDD (tests unitaires et e2e écrits d'abord, et décision sur l'outillage de test s'il manque), vérifications et build, revue finale, mises à jour de la documentation, fiche `docs/tasks/`.

## 3. Analyse

Explorer le code concerné (lecture seule) pour que le plan repose sur l'existant réel et non sur des suppositions :

- fichiers, fonctions et composants concernés, et leurs appelants ;
- fonctions et utilitaires existants à réutiliser ;
- décisions déjà prises (spécification, `docs/tasks/`) qui contraignent l'approche ;
- pour un bug : cause racine probable, et comment la reproduire dans un test ;
- risques de régression : autres modes, écrans, formats ou données existantes, comportement en build de production ;
- ce qui est hors périmètre.

Relever au passage tous les **points de doute** : comportement attendu pas clair, plusieurs approches possibles, compromis (simplicité, performance, compatibilité), dépendance à ajouter, outillage de test absent, impact sur la documentation ou le format existant.

## 4. Plan et doutes (itératif)

1. **Présenter un premier plan** (format ci-dessous) en indiquant clairement les points encore ouverts.
2. **Lever chaque doute avec `AskUserQuestion`**, en proposant des solutions concrètes plutôt qu'une question ouverte :
   - 2 à 4 options par question, la solution recommandée en premier avec « (Recommandé) » dans son libellé ;
   - pour chaque option, sa conséquence sur le plan (effort, risque, compatibilité) dans la description ;
   - regrouper les doutes indépendants dans un même appel (jusqu'à 4 questions) ;
   - l'utilisateur peut toujours choisir « Other » pour **proposer une autre solution** ou **poser une question** : dans ce cas, répondre à sa question ou analyser sa solution (faisabilité, conséquences, en relisant le code si besoin), puis reposer la question si le point reste ouvert.
3. **Mettre à jour le plan** avec chaque décision prise, et le représenter quand il a changé de façon notable.
4. Recommencer tant qu'il reste des doutes qui changent réellement l'implémentation. Un choix qui a une réponse conventionnelle évidente n'a pas besoin de question : le trancher et l'indiquer dans le plan.

L'utilisateur peut aussi, à tout moment, poser une question libre sur le plan ou demander un changement : y répondre, ajuster le plan, et reprendre là où on en était.

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
Régressions possibles, zones sensibles.

## Hors périmètre
Ce qui ne sera pas fait dans cette tâche.
```

## 5. Validation

Quand il ne reste plus de doute, présenter le **plan complet final**, puis demander la validation avec `AskUserQuestion` :

- **Valider le plan** : passer à l'étape « Issue GitHub ».
- **Modifier le plan** : l'utilisateur précise ce qu'il veut changer (via « Other » ou à la réponse suivante) ; ajuster et redemander la validation.
- **Poser une question** : y répondre, puis redemander la validation.

Ne passer à la suite qu'après une validation explicite.

## 6. Issue GitHub

### Si une issue était référencée : la reformuler et la compléter avec le plan

1. Préparer le **nouveau titre** (court et précis, reformulé si besoin) et le **nouveau corps** :

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

   Garder toujours la description d'origine dans la section repliable : rien de ce qu'a écrit l'auteur ne doit être perdu.
2. Montrer le titre et le corps à l'utilisateur et lui demander confirmation (`AskUserQuestion` : « Mettre à jour l'issue » / « Modifier le texte » / « Ne pas mettre à jour »).
3. Après accord, mettre à jour l'issue via `issue_write` (titre et corps). Ne pas toucher à son statut, à son assignation ni à ses labels existants. Si elle avait été fermée et que l'utilisateur a demandé de continuer, la rouvrir.
4. Relire l'issue (`issue_read`) pour vérifier la mise à jour, et le confirmer en une ligne avec le lien.

### Si aucune issue n'était référencée : proposer de la créer

1. Préparer un **titre** et un **corps** sur le même modèle (sections « Description » et « Plan », sans « Description d'origine »).
2. Proposer la création avec `AskUserQuestion` : « Créer l'issue » / « Modifier le texte » / « Ne pas créer ».
3. Après accord, créer l'issue via `issue_write` (dépôt de `git remote get-url origin`). Si le dépôt a déjà des labels de type (ex. `bug`, `enhancement`), appliquer celui qui correspond ; ne pas en créer de nouveaux.
4. Donner à l'utilisateur le numéro et le lien de l'issue créée.

En cas d'échec d'écriture sur GitHub (droits, outil indisponible), le signaler avec la cause, sans prétendre que l'issue a été mise à jour ou créée, et donner le titre et le corps en texte pour que l'utilisateur puisse les coller lui-même.

## 7. Proposer l'exécution

Terminer en proposant avec `AskUserQuestion` de lancer l'implémentation :

- **Lancer `project-execute` avec l'issue `#NN`** (recommandé quand une issue porte le plan) : invoquer la skill `project-execute` (`Skill`, `skill: "project-execute"`, `args: "#NN"`). Elle passera l'issue en « In Progress » et suivra le plan qu'elle contient.
- **Lancer `project-execute` sans issue** (si l'utilisateur n'a pas voulu d'issue) : invoquer `project-execute` en lui passant le plan validé, qui reste dans la conversation.
- **Plus tard** : ne rien lancer. Rappeler que le plan est dans l'issue `#NN` (ou, sans issue, donner le plan complet dans la réponse pour qu'il ne soit pas perdu), et qu'il suffira de lancer `project-execute #NN`.
