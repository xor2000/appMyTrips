---
name: project-execute
description: Passe en « In Progress » l'issue GitHub référencée (numéro ou lien) s'il y en a une, charge le contexte sauvegardé du dépôt (docs/specification.md + docs/tasks/) avant de corriger un bug ou de développer une fonctionnalité dans ce projet, puis encadre l'implémentation en TDD (tests unitaires et e2e écrits d'abord), la vérification, la revue finale (avec correction des points relevés), la mise à jour de la documentation, et propose à la fin de fermer l'issue référencée. Utiliser dès que l'utilisateur demande une correction de bug, une correction, ou une fonctionnalité nouvelle ou modifiée dans ce projet.
---

# Contexte projet

Cette skill rappelle de consulter la mémoire du projet avant d'agir, pour ne pas re-dériver un contexte déjà établi ni réintroduire un bug déjà corrigé, puis de relire son propre travail avant de le rendre.

Déroulé : **Issue GitHub en « In Progress » (si référencée) → Avant de commencer → Pendant le développement → Vérifications → Revue du travail → Après le travail → Compte rendu → Proposer de fermer l'issue (si référencée)**.

## Choix du modèle selon le type de tâche

Cette règle s'applique à toutes les étapes de la skill.

- **Tâches de type script** : exécution de commandes sans réflexion de fond, comme les commandes `git` (`status`, `branch`, `worktree`, `remote`, `log`, `diff`, `add`, `commit` une fois le message rédigé), les commandes PowerShell ou shell, les opérations GitHub (outils MCP `github`, CLI `gh` : lecture et mise à jour d'issue, statut, labels, commentaires, projets) et le simple lancement des suites de tests ou du build. L'agent **peut** les confier à un modèle plus bas, via un sous-agent (`Agent`) avec `model: "sonnet"` et `effort: "high"`, ou `model: "opus"` et `effort: "medium"`.
  - Le brief du sous-agent donne les opérations exactes (commandes, valeurs, textes déjà rédigés) et le retour attendu (sortie brute, état vérifié). Le sous-agent n'analyse pas et ne décide rien : sur un résultat inattendu (erreur, conflit, droit insuffisant), il s'arrête et le rapporte à l'agent principal, qui décide de la suite.
  - Pour une commande unique et courte, l'exécuter directement reste possible : la délégation coûte un aller-retour.
- **Toutes les autres tâches** : analyse, conception, design, codage (y compris l'écriture des tests), interprétation des résultats (tests en échec, erreurs de build, diff à relire), revue, rédaction de la documentation et du compte rendu. Elles se font **toujours avec Opus en effort high** : par l'agent principal, ou par un sous-agent lancé avec `model: "opus"` et `effort: "high"`, jamais avec un modèle plus bas.
- Une skill ne peut pas changer le modèle de la session. Si la session ne tourne pas sur Opus (ou si son effort connu est inférieur à high), le signaler à l'utilisateur en une ligne dès le lancement et lui proposer de changer de modèle ou d'effort avant l'analyse et le codage.

## Issue GitHub référencée : passer son statut à « In Progress » (en premier)

**Dès que la skill est lancée avec une référence d'issue GitHub**, que ce soit dans les arguments de la skill ou dans la demande de l'utilisateur, la **première action** (avant toute lecture de contexte, tout code ou tout test) est de passer cette issue au statut « In Progress ». Sont des références d'issue :

- un numéro : `#12`, `12`, « issue 12 », « l'issue n°12 », « ticket 12 » ;
- un lien : `https://github.com/<owner>/<repo>/issues/12`.

Étapes :

1. **Identifier le dépôt et le numéro.** Pour un lien, owner, repo et numéro viennent de l'URL. Pour un numéro seul, owner/repo viennent de `git remote get-url origin`. Si le lien désigne un autre dépôt que celui du projet, le signaler à l'utilisateur et lui demander confirmation avant d'y toucher.
2. **Lire l'issue et ses commentaires** (`issue_read`) : vérifier qu'elle existe et qu'elle est ouverte, et récupérer son contenu (la skill `project-plan` a peut-être déjà ajouté une section « Plan » dans sa description). Si elle est fermée, demander à l'utilisateur s'il faut la rouvrir avant de continuer.
3. **Passer le statut à « In Progress »**, en utilisant le premier mécanisme disponible :
   1. **Champ de statut de l'issue** : appeler `list_issue_fields` (owner, repo). Si un champ de type statut existe (single-select, ex. « Status »), positionner l'issue sur son option équivalente à « In Progress » (« In Progress », « En cours », « Doing »…) via `issue_write` (`issue_fields` avec `field_option_name`).
   2. **Projet GitHub (Projects)** : si l'issue appartient à un projet GitHub qui a un champ « Status » et que la CLI `gh` est disponible (avec le droit `project`, sinon `gh auth refresh -s project`), positionner l'élément du projet sur l'option « In Progress » : récupérer l'identifiant de l'élément et du projet (`gh api graphql`, `repository.issue.projectItems`), les identifiants du champ et de l'option (`gh project field-list <numéro> --owner <owner> --format json`), puis `gh project item-edit --id <item> --project-id <projet> --field-id <champ> --single-select-option-id <option>`.
   3. **Sinon, label** : appliquer le label `in-progress` via `issue_write` (`labels`, **en conservant les labels déjà présents** ; le label est créé automatiquement par GitHub s'il n'existe pas encore).
4. **Vérifier** en relisant l'issue (`issue_read`) que le statut ou le label a bien été appliqué, et l'indiquer à l'utilisateur en une ligne (mécanisme utilisé et nouvel état).
5. **En cas d'échec** (droits insuffisants, outil GitHub indisponible, `gh` absent ou non authentifié), le signaler clairement à l'utilisateur avec la cause, sans prétendre que le statut a changé, puis poursuivre la tâche. Ne pas bloquer le développement pour ça.

Ne pas modifier d'autres propriétés de l'issue à cette étape (assignation, titre, description, jalon) sans demande de l'utilisateur.

## Avant de commencer

1. Lire **[`docs/specification.md`](../../../docs/specification.md)** — contexte métier, architecture technique, formats et schéma de données, surface API, intégrations externes, contraintes non fonctionnelles, décisions d'architecture. Regarder en particulier la section des limites connues / points d'attention / reste à faire : la demande en cours recoupe peut-être une limitation déjà connue (ex. contrat d'une API tierce non vérifié, déploiement non fait, évolution déjà envisagée avec une approche décidée).
   - Si le fichier n'existe pas, le signaler et s'appuyer sur `CLAUDE.md` et `README.md` ; proposer de le créer en fin de tâche plutôt que de le créer d'office.
2. Lire **[`docs/tasks/`](../../../docs/tasks/)** — un fichier par session de travail significative (`AAAA-MM-JJ-<slug>.md`). Lire au moins le(s) plus récent(s) : ils documentent les décisions déjà prises et pourquoi, les bugs non triviaux déjà rencontrés et corrigés (pour ne pas les réintroduire), et l'état d'avancement laissé en suspens.
   - Si le dossier est vide ou absent, c'est normal pour un projet jeune : il sera créé avec la première entrée (voir « Après le travail »).
3. Si la demande touche une zone déjà documentée (un composant, une intégration externe, un mécanisme de cache/synchronisation…), chercher dans `docs/tasks/` (recherche par mots-clés : nom de fichier, de fonction, de composant) si un piège connu est déjà expliqué dans cette zone avant de re-explorer depuis zéro.
4. Relire les **conventions et pièges** listés dans `CLAUDE.md` qui concernent les fichiers qui vont être touchés : ils servent aussi de grille pour la revue finale.
5. **État du dépôt** : `git status` et `git branch --show-current`.
   - Des modifications non commitées qui ne sont pas les siennes : les signaler et ne pas les écraser ni les mélanger au travail en cours sans accord.
   - Ne pas committer sans accord de l'utilisateur.
6. Si une issue GitHub est référencée, tenir compte de son contenu (description, commentaires, plan éventuel) lu dans la section « Issue GitHub référencée » : c'est la définition de la tâche, au même titre que la demande de l'utilisateur. Si elle contient une section « Plan » (skill `project-plan`), le suivre : ses décisions ont été validées par l'utilisateur. S'en écarter seulement si le code ou les tests montrent qu'il est faux ou incomplet, et dans ce cas le signaler à l'utilisateur avant de changer d'approche.
7. **Lever les ambiguïtés avant de coder** : si la demande admet plusieurs interprétations qui changent réellement l'implémentation (comportement attendu, périmètre, compatibilité avec l'existant), poser la question (`AskUserQuestion`). Pour un choix qui a une réponse conventionnelle évidente, trancher, le mentionner dans le compte rendu, et avancer.
8. **Choisir où travailler : demander à l'utilisateur et attendre sa réponse.** Juste avant de commencer l'implémentation (donc avant d'écrire le moindre test ou code), demander avec `AskUserQuestion` :
   - **Utiliser la branche courante** (`<nom de la branche>`) : travailler directement dans le dossier actuel. Si c'est la branche principale (`main`), le rappeler dans la question : il faudra ensuite une branche de travail pour ouvrir une pull request avec `project-pullrequest`.
   - **Créer un worktree** : Claude crée un worktree git séparé, sur une nouvelle branche (`fix/<slug>` ou `feat/<slug>`, avec le numéro d'issue s'il y en a une, ex. `fix/12-<slug>`), avec l'outil `EnterWorktree`, et tout le travail se fait dedans. Préciser dans la question que les modifications non commitées du dossier actuel ne suivent pas dans le worktree.

   **Ne rien implémenter tant que l'utilisateur n'a pas répondu.** S'il répond autre chose (via « Other », ex. créer une branche dans le dossier actuel), suivre sa réponse. Si l'outil `EnterWorktree` n'est pas disponible, créer le worktree avec `git worktree add <dossier> -b <branche>` à côté du dépôt, et travailler dans ce dossier. Rappeler le chemin du worktree et le nom de la branche dans le compte rendu.

## Pendant le développement

### Commencer par les tests (TDD)

Le développement démarre **toujours par l'écriture des tests**, avant tout code de production :

1. **Écrire les tests unitaires** qui décrivent le comportement attendu : pour un bug, un test qui reproduit exactement le problème signalé ; pour une fonctionnalité, les cas nominaux, les cas limites (valeurs vides/absentes, erreurs, bornes) et la compatibilité avec l'existant (valeurs par défaut, anciens formats).
2. **Écrire les tests end-to-end** qui décrivent le parcours utilisateur concerné, de bout en bout, dans l'application réelle (y compris les autres modes ou écrans du projet touchés par le changement).
3. **Lancer ces nouveaux tests et constater qu'ils échouent**, pour la bonne raison (le comportement manque ou le bug est présent, et non une erreur de syntaxe, d'import ou de configuration du test). Un test qui passe déjà avant l'implémentation ne prouve rien : le revoir.
4. **Implémenter le minimum de code** pour faire passer les tests, puis relancer toute la suite (unitaires **et** e2e) pour vérifier qu'aucun test existant ne casse.
5. **Remanier** (lisibilité, suppression de duplication) une fois les tests au vert, en les relançant après chaque remaniement.
6. Si l'implémentation fait apparaître un cas non prévu, **ajouter d'abord le test** correspondant, le voir échouer, puis le traiter.

Emplacement, nommage et outils des tests : suivre ceux déjà en place dans le projet (voir `CLAUDE.md` / `README.md` / configuration des tests) plutôt que d'en introduire de nouveaux.

**Si le projet n'a pas encore d'outillage de test** (unitaire et/ou e2e), ne pas l'ajouter d'office : proposer à l'utilisateur (`AskUserQuestion`) de le mettre en place en suivant l'écosystème du projet (ex. Vitest pour un projet Vite, Playwright pour l'e2e d'une application web), en précisant les dépendances ajoutées et les scripts créés. S'il accepte, installer l'outillage, ajouter les scripts de test au projet et les documenter dans `README.md` et `CLAUDE.md`, puis appliquer le TDD ci-dessus. S'il refuse, écrire les scénarios de test attendus (cas unitaires et parcours e2e) avant de coder, dans l'entrée `docs/tasks/`, et les dérouler manuellement selon la procédure de `CLAUDE.md`.

### Implémentation

- **Bug** : reproduire le problème (le test écrit à l'étape TDD en est la preuve) et identifier la cause racine avant de corriger — ne pas masquer un symptôme. Chercher si la même erreur existe ailleurs dans le code (même motif, même fonction appelée) et la corriger aussi si elle relève de la même cause, avec son propre test.
- **Fonctionnalité** : rester compatible avec l'existant (valeurs par défaut pour les nouvelles options, formats et données existants toujours valides), sauf décision contraire explicite de l'utilisateur.
- Suivre les bonnes pratiques déjà en place dans le projet (architecture, conventions de nommage, langue du code et des commentaires, typage, pas d'abstraction prématurée, voir `CLAUDE.md`) plutôt que d'introduire un nouveau style ou une nouvelle convention. Réutiliser les fonctions et utilitaires existants plutôt que d'en dupliquer.
- **Rester dans le périmètre** : ne pas refactorer, reformater ou « améliorer » du code sans rapport avec la demande. Un problème repéré hors périmètre est noté pour le compte rendu (et éventuellement pour la section des limites connues de la spécification), pas corrigé en douce.
- Ne pas ajouter de dépendance sans nécessité réelle ; si c'est indispensable, le justifier dans le compte rendu et dans l'entrée `docs/tasks/`.
- Ne jamais committer ni écrire en clair de secret, clé d'API ou identifiant ; ne pas committer sans demande de l'utilisateur.

## Vérifications

Avant de considérer la tâche terminée, **toujours** lancer et faire passer (commandes exactes : voir `CLAUDE.md` / `README.md` / `package.json` ou équivalent) :

- les tests unitaires de chaque partie du projet (ex. backend, frontend, packages),
- **et** les tests end-to-end s'il y en a — pas seulement les unitaires, même pour un changement qui semble purement backend ou purement visuel,
- en s'assurant que les tests écrits en TDD (voir « Commencer par les tests ») couvrent bien le changement final, et en mettant à jour les tests existants devenus inexacts plutôt que de se reposer uniquement sur la suite existante.

Vérifier aussi que le projet **build** (typecheck, lint et build de production de chaque partie concernée) — certains comportements (ex. service worker, optimisations, variables d'environnement de prod, chemins relatifs) ne se manifestent qu'en build, jamais en mode `dev`.

**S'il n'existe pas de tests automatisés** (l'utilisateur a refusé de mettre en place l'outillage, voir la section TDD) ou pas de linter, le dire explicitement et appliquer à la place la procédure de vérification manuelle décrite dans `CLAUDE.md` (ex. parcours de l'application dans le navigateur, formats d'écran, modes d'utilisation). Pour un changement visible, lancer réellement l'application (skill `run`, ou navigateur via les outils disponibles) et vérifier le comportement, pas seulement le code. Si une vérification ne peut pas être faite (outil indisponible, matériel requis, service externe), le noter clairement dans le compte rendu comme **non vérifié**, sans prétendre le contraire.

Un test ou un build qui échoue n'est jamais « hors sujet » par défaut : vérifier s'il échouait déjà avant le changement (par ex. en le relançant sur la branche principale dans un `git worktree` séparé, sans toucher aux modifications en cours) avant de conclure qu'il est préexistant, et le signaler dans tous les cas.

## Revue du travail

Une fois l'implémentation vérifiée, **relire l'ensemble du travail comme le ferait un relecteur exigeant**, avant de rédiger la documentation et le compte rendu.

1. **Rassembler le périmètre** : `git status` (fichiers non suivis compris) et `git diff` (plus `git diff <branche principale>...HEAD` si des commits ont été faits sur une branche de travail). Relire chaque fichier modifié **dans son contexte** (les fonctions appelantes et appelées, pas seulement les lignes du diff).
2. **Passer la grille de revue** :
   - **Exactitude** : le changement fait-il ce qui est demandé, dans tous les cas ? Cas limites (valeurs vides/absentes, listes vides, premier/dernier élément, erreurs réseau, entrées inattendues), conditions de course et code asynchrone (une suite différée agit-elle encore sur un état déjà quitté ?).
   - **Régressions** : autres appelants de ce qui a été modifié, anciens formats et données existantes, autres modes, écrans ou plateformes du projet, comportement en build de production.
   - **Conventions du projet** : chaque convention et piège de `CLAUDE.md` concerné par les fichiers touchés, style et langue du code environnant, séparation des responsabilités telle que définie par l'architecture.
   - **Sécurité** : injection (HTML, SQL, commandes), échappement des données affichées, secrets, validation des entrées externes.
   - **Performance et robustesse** : travail inutile dans une boucle ou un rendu, fuite d'écouteurs ou de minuteries, erreurs silencieusement avalées.
   - **Propreté** : pas de code mort, de `console.log` / code de débogage, de TODO sans suite, de fichier temporaire ou de modification sans rapport laissés derrière soi ; pas de duplication d'un utilitaire existant.
   - **Tests** : les tests ont-ils bien été écrits avant le code et vus en échec ? Le changement est-il réellement couvert, en unitaire **et** en e2e (ou vérifié manuellement) ? Les nouveaux tests échoueraient-ils sans la correction ? Testent-ils le comportement plutôt que les détails d'implémentation ?
   - **Documentation** : `README.md`, `docs/specification.md` et commentaires du code restent-ils exacts après le changement ?
3. **Lister les points à revoir** : pour chaque point, le fichier et la ligne (`chemin:ligne`), le problème, sa gravité (**bloquant** : bug, régression, faille ; **important** : cas limite non géré, convention non respectée, test manquant ; **mineur** : lisibilité, nommage, propreté).
4. **Corriger les points relevés** :
   - corriger tous les points bloquants et importants, et les mineurs quand la correction est simple et dans le périmètre ;
   - un point qui demande une décision de l'utilisateur (changement de comportement, de périmètre, compromis) : ne pas trancher seul, le lui soumettre ;
   - un point hors périmètre ou volontairement non corrigé : le garder pour le compte rendu avec la raison.
5. **Relancer les vérifications** concernées (tests, build, vérification manuelle) après les corrections, puis refaire une passe de revue rapide sur ce qui a été corrigé. Recommencer tant qu'il reste un point bloquant ou important.

La revue doit être honnête : si elle ne trouve rien, le dire simplement ; ne pas inventer de points pour remplir la liste, ni en passer sous silence.

## Après le travail

Pour chaque tâche (correction de bug ou nouvelle fonctionnalité) traitée sous cette skill :

- **Toujours** ajouter un nouveau fichier dans `docs/tasks/` (un fichier par tâche, `AAAA-MM-JJ-<slug>.md` avec la date du jour, sur le modèle des entrées existantes ; créer le dossier s'il n'existe pas). À défaut d'entrée existante, utiliser ce modèle :

  ```markdown
  # <Titre court de la tâche>

  - Date : AAAA-MM-JJ
  - Type : correction | fonctionnalité | autre
  - Issue : #NN (si applicable)

  ## Demande
  Ce qui a été demandé, en une ou deux phrases.

  ## Ce qui a été fait
  Changements principaux, fichiers touchés.

  ## Décisions et pourquoi
  Choix d'approche, alternatives écartées et raison.

  ## Bugs et pièges rencontrés
  Problèmes non triviaux, leur cause racine et comment les éviter à l'avenir.

  ## Tests et vérifications
  Tests unitaires et e2e écrits en TDD (fichiers, cas couverts), résultats des suites complètes,
  build et vérifications manuelles effectués ; ce qui n'a pas pu être vérifié.

  ## Revue
  Points relevés à la revue et comment ils ont été traités ; points laissés ouverts.

  ## Reste à faire
  Ce qui est laissé en suspens (ou « Rien »).
  ```

- Mettre à jour `docs/specification.md` si besoin (architecture, formats ou schéma de données, surface API, périmètre fonctionnel, décisions d'architecture qui ont changé). Mettre à jour aussi sa section des limites connues / reste à faire : retirer une limite levée par la tâche, ajouter une limite découverte et non traitée. Sinon, ne pas y toucher.
- Mettre à jour `README.md` si besoin en fonction des modifications effectuées (commandes, options, format documenté) — sinon, ne pas y toucher.
- Mettre à jour `CLAUDE.md` seulement si la tâche a fait apparaître une convention ou un piège durable que tout travail futur doit connaître (et qui n'y figure pas déjà).
- Si la tâche référence une issue GitHub : y ajouter un commentaire de synthèse (`add_issue_comment` : ce qui a été fait, vérifications, points restants). Ne pas la fermer d'office : la fermeture est proposée à l'utilisateur à la fin (voir « Proposer de fermer l'issue »).

## Compte rendu

Terminer par un compte rendu court à l'utilisateur :

- ce qui a été fait (fichiers principaux, en `chemin:ligne` quand c'est utile) ;
- les vérifications effectuées et leur résultat réel (y compris les échecs et ce qui n'a pas pu être vérifié) ;
- le résultat de la revue : points relevés et corrigés, points laissés ouverts avec la raison, décisions qui attendent l'utilisateur ;
- les documents mis à jour (`docs/tasks/…`, `docs/specification.md`, `README.md`) ;
- la suite possible (ex. committer, ouvrir une pull request avec la skill `project-pullrequest`).

## Proposer de fermer l'issue (si une issue était référencée)

Si une issue GitHub a été référencée dans la demande (numéro ou lien, voir la première section), **toujours terminer en proposant à l'utilisateur de la fermer**, juste après le compte rendu, avec `AskUserQuestion`. Ne jamais la fermer sans son accord explicite.

1. **Rappeler l'état réel avant de poser la question** : si des vérifications ont échoué ou n'ont pas pu être faites, ou si des points de la revue ou du « Reste à faire » sont encore ouverts, le dire dans la question. Dans ce cas, recommander de la laisser ouverte plutôt que de la fermer.
2. **Options à proposer** :
   - **Fermer maintenant** : l'issue est terminée.
   - **Laisser ouverte, fermeture par la pull request** : elle sera fermée automatiquement à la fusion, en mettant `Closes #NN` dans la description de la PR (skill `project-pullrequest`). C'est l'option à recommander si le travail n'est pas encore commité ni fusionné sur `main`.
   - **Laisser ouverte** : il reste du travail, ou l'utilisateur veut la fermer lui-même.
3. **Si l'utilisateur choisit de fermer** :
   - fermer l'issue via `issue_write` (`state: closed`, `state_reason: completed`) ;
   - mettre à jour le statut avec le même mécanisme qu'à l'ouverture : option « Done » (ou équivalent : « Terminé », « Closed ») du champ statut ou du projet GitHub ; si c'est le label `in-progress` qui avait été posé, le retirer en conservant les autres labels ;
   - relire l'issue (`issue_read`) pour vérifier qu'elle est bien fermée, et le confirmer en une ligne. En cas d'échec, donner la cause sans prétendre que l'issue est fermée.
4. **Si l'utilisateur choisit de la laisser ouverte** : ne rien changer. Le statut reste « In Progress ». Si la fermeture doit passer par la PR, rappeler d'y mettre `Closes #NN`.
