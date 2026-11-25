---
name: project-execute
description: Passe en « In Progress » l'issue GitHub référencée (numéro ou lien) s'il y en a une, charge le contexte sauvegardé du dépôt (docs/specification.md + docs/tasks/) avant de corriger un bug ou de développer une fonctionnalité dans ce projet, puis encadre l'implémentation en TDD (tests unitaires et e2e écrits d'abord), la vérification, la revue finale (avec correction des points relevés), la mise à jour de la documentation, et propose à la fin de fermer l'issue référencée. Utiliser dès que l'utilisateur demande une correction de bug, une correction, ou une fonctionnalité nouvelle ou modifiée dans ce projet.
---

# Contexte projet

Cette skill fait consulter la mémoire du projet avant d'agir (pour ne pas re-dériver un contexte établi ni réintroduire un bug corrigé), puis relire son propre travail avant de le rendre.

Déroulé : **Issue en « In Progress » (si référencée) → Avant de commencer → Développement (TDD) → Vérifications → Revue → Après le travail → Compte rendu → Proposer de fermer l'issue (si référencée)**.

## Modèles, effort et délégation

Appliquer **[`references/modeles.md`](references/modeles.md)** à toutes les étapes ; le lire au lancement s'il n'est pas déjà dans la conversation. Les codes entre crochets (ex. [X1]) renvoient à ses catégories de travail. Contrôler dès le lancement le modèle de la session, comme indiqué dans ce fichier.

## Issue GitHub référencée : passer son statut à « In Progress » (en premier)

Si la skill est lancée avec une référence d'issue (arguments ou demande : `#12`, `12`, « issue 12 », « ticket 12 », ou lien `https://github.com/<owner>/<repo>/issues/12`), c'est la **première action**, avant toute lecture de contexte, tout code ou tout test.

1. **Dépôt et numéro** : depuis l'URL pour un lien, sinon owner/repo via `git remote get-url origin`. Si le lien désigne un autre dépôt que celui du projet, le signaler et demander confirmation avant d'y toucher.
2. **Lire l'issue et ses commentaires** [G2] (`issue_read`) : vérifier qu'elle existe et qu'elle est ouverte, récupérer son contenu (dont une éventuelle section « Plan » ajoutée par `project-plan`). Si elle est fermée, demander s'il faut la rouvrir avant de continuer.
3. **Passer le statut à « In Progress »** [G1], avec le premier mécanisme disponible :
   1. **Champ de statut de l'issue** : `list_issue_fields` (owner, repo). Si un champ single-select de type statut existe (ex. « Status »), positionner l'issue sur l'option équivalente à « In Progress » (« En cours », « Doing »…) via `issue_write` (`issue_fields` avec `field_option_name`).
   2. **Projet GitHub** : si l'issue appartient à un projet avec un champ « Status » et que `gh` est disponible (droit `project`, sinon `gh auth refresh -s project`) : identifiants de l'élément et du projet (`gh api graphql`, `repository.issue.projectItems`), du champ et de l'option (`gh project field-list <numéro> --owner <owner> --format json`), puis `gh project item-edit --id <item> --project-id <projet> --field-id <champ> --single-select-option-id <option>`.
   3. **Sinon, label** `in-progress` via `issue_write` (`labels`, **en conservant les labels présents** ; GitHub crée le label s'il n'existe pas).
4. **Vérifier** en relisant l'issue que le statut ou le label est appliqué, et l'indiquer en une ligne (mécanisme et nouvel état). Le retour du sous-agent [G1] suffit : mécanisme utilisé et état relu.
5. **En cas d'échec** (droits, outil GitHub indisponible, `gh` absent ou non authentifié) : donner la cause sans prétendre que le statut a changé, puis poursuivre la tâche sans bloquer.

Ne modifier aucune autre propriété de l'issue (assignation, titre, description, jalon) sans demande de l'utilisateur.

## Avant de commencer

Si ce contexte est déjà dans la conversation (ex. `project-plan` vient de le charger dans cette session), **ne pas le relire** : compléter seulement ce qui manque.

1. **[`docs/specification.md`](../../../docs/specification.md)** : contexte métier, architecture, formats et schéma de données, API, intégrations, contraintes, décisions d'architecture. Lire par sections (titres d'abord), en particulier les limites connues / points d'attention / reste à faire : la demande recoupe peut-être une limitation connue ou une évolution déjà décidée.
   - Fichier absent : le signaler, s'appuyer sur `CLAUDE.md` et `README.md`, et proposer de le créer en fin de tâche plutôt que d'office.
2. **[`docs/tasks/`](../../../docs/tasks/)** (un fichier par session significative, `AAAA-MM-JJ-<slug>.md`) : décisions prises et pourquoi, bugs déjà corrigés (à ne pas réintroduire), travail en suspens. Lire la ou les fiches les plus récentes ; pour la zone touchée, chercher les pièges connus par mots-clés (fichier, fonction, composant) [E2] avant de re-explorer depuis zéro.
   - Dossier vide ou absent : normal pour un projet jeune, il sera créé avec la première fiche.
3. **`CLAUDE.md`** : conventions et pièges qui concernent les fichiers touchés ; ils servent aussi de grille pour la revue.
4. **État du dépôt** [G4] : `git status` et `git branch --show-current`. Des modifications non commitées qui ne sont pas les siennes : les signaler, ne pas les écraser ni les mélanger au travail sans accord. Ne pas committer sans accord.
5. **Issue référencée** : son contenu définit la tâche au même titre que la demande. Une section « Plan » (`project-plan`) a été validée par l'utilisateur : la suivre, et ne s'en écarter que si le code ou les tests la montrent fausse ou incomplète, en le signalant avant de changer d'approche.
6. **Ambiguïtés** : si la demande admet plusieurs interprétations qui changent l'implémentation (comportement, périmètre, compatibilité), poser la question (`AskUserQuestion`). Un choix à réponse conventionnelle évidente : le trancher, le mentionner dans le compte rendu, avancer.
7. **Où travailler : demander et attendre la réponse**, juste avant d'écrire le moindre test ou code (`AskUserQuestion`) :
   - **Branche courante** (`<nom>`) : travailler dans le dossier actuel. Si c'est `main`, rappeler qu'il faudra une branche de travail pour ouvrir une pull request avec `project-pullrequest`.
   - **Créer un worktree** sur une nouvelle branche (`fix/<slug>` ou `feat/<slug>`, avec le numéro d'issue s'il y en a une, ex. `fix/12-<slug>`) avec `EnterWorktree`, et tout faire dedans. Préciser que les modifications non commitées du dossier actuel ne suivent pas.

   **Ne rien implémenter avant la réponse.** Autre réponse (« Other », ex. branche dans le dossier actuel) : la suivre. Sans `EnterWorktree` : `git worktree add <dossier> -b <branche>` à côté du dépôt. Rappeler le chemin du worktree et la branche dans le compte rendu.

## Pendant le développement

### Commencer par les tests (TDD)

Toujours écrire les tests avant le code de production [R2] :

1. **Tests unitaires** du comportement attendu : pour un bug, un test qui reproduit exactement le problème ; pour une fonctionnalité, cas nominaux, cas limites (vide/absent, erreurs, bornes) et compatibilité (valeurs par défaut, anciens formats).
2. **Tests end-to-end** du parcours utilisateur concerné, dans l'application réelle (y compris les autres modes ou écrans touchés).
3. **Les lancer et les voir échouer** [X1] pour la bonne raison (comportement absent ou bug présent, pas une erreur de syntaxe, d'import ou de configuration). Un test qui passe déjà ne prouve rien : le revoir.
4. **Implémenter le minimum** pour les faire passer, puis relancer toute la suite, unitaires **et** e2e [X1].
5. **Remanier** une fois au vert, en relançant les tests après chaque remaniement.
6. Cas imprévu en cours de route : **d'abord le test**, le voir échouer, puis le traiter.

Emplacement, nommage et outils : suivre ceux du projet (`CLAUDE.md`, `README.md`, configuration des tests).

**Pas d'outillage de test** (unitaire et/ou e2e) : ne pas l'ajouter d'office ; le proposer (`AskUserQuestion`) selon l'écosystème du projet (ex. Vitest pour Vite, Playwright pour l'e2e web), en précisant dépendances et scripts. Accepté : l'installer [X4], ajouter les scripts, les documenter dans `README.md` et `CLAUDE.md`, puis appliquer le TDD. Refusé : écrire les scénarios attendus (cas unitaires et parcours e2e) dans la fiche `docs/tasks/` avant de coder, et les dérouler manuellement selon `CLAUDE.md`.

### Implémentation

- **Bug** : trouver la cause racine avant de corriger [R3], ne pas masquer un symptôme. Chercher le même motif ailleurs [E1] et le corriger aussi s'il relève de la même cause, avec son propre test.
- **Fonctionnalité** : rester compatible avec l'existant (valeurs par défaut, formats et données existants valides), sauf décision explicite de l'utilisateur.
- Suivre les pratiques du projet (architecture, nommage, langue du code et des commentaires, typage, pas d'abstraction prématurée) et réutiliser les utilitaires existants plutôt que d'en dupliquer.
- **Rester dans le périmètre** : pas de refactorisation, reformatage ou « amélioration » sans rapport. Un problème hors périmètre est noté pour le compte rendu (et éventuellement les limites connues de la spécification), pas corrigé en douce.
- Pas de dépendance sans nécessité réelle ; sinon la justifier dans le compte rendu et la fiche `docs/tasks/`.
- Jamais de secret, clé d'API ou identifiant en clair ; pas de commit sans demande.

## Vérifications

Avant de considérer la tâche terminée, **toujours** lancer et faire passer [X1] (commandes : `CLAUDE.md`, `README.md`, `package.json` ou équivalent) :

- les tests unitaires de chaque partie (backend, frontend, packages…) ;
- **et** les tests e2e s'il y en a, même pour un changement qui semble purement backend ou purement visuel ;
- le **build** de chaque partie concernée (typecheck, lint, build de production) : certains comportements (service worker, optimisations, variables d'environnement, chemins relatifs) n'apparaissent qu'en build.

Vérifier que les tests écrits en TDD couvrent bien le changement final, et mettre à jour les tests existants devenus inexacts.

**Sans tests automatisés ni linter** : le dire explicitement et suivre la procédure manuelle de `CLAUDE.md`. Pour un changement visible, vérifier dans l'application réelle [X3] (skill `run` ou navigateur), pas seulement dans le code. Une vérification impossible (outil, matériel, service externe) est notée **non vérifiée** dans le compte rendu.

Un échec n'est jamais « hors sujet » par défaut : vérifier s'il existait déjà sur la branche principale dans un worktree séparé [X2], sans toucher au travail en cours, et le signaler dans tous les cas.

## Revue du travail

Une fois l'implémentation vérifiée, relire tout le travail comme un relecteur exigeant [R4], avant la documentation.

1. **Périmètre** [G4] : `git status` (fichiers non suivis compris), `git diff --stat`, puis le diff utile (et `git diff <branche principale>...HEAD` si des commits existent). Relire chaque changement dans son contexte (appelants et appelés), par lectures ciblées.
   - **Lancer aussitôt la revue indépendante** [R6] en arrière-plan, pour qu'elle tourne pendant l'auto-revue (voir l'étape 4).
2. **Grille** (auto-revue) :
   - **Exactitude** : tous les cas, cas limites (vide, premier/dernier élément, erreurs réseau, entrées inattendues), asynchrone et conditions de course (une suite différée agit-elle sur un état déjà quitté ?).
   - **Régressions** : autres appelants, anciens formats et données, autres modes, écrans ou plateformes, build de production.
   - **Conventions** : pièges de `CLAUDE.md` concernés, style et langue du code environnant, séparation des responsabilités.
   - **Sécurité** :
     - injection (HTML/XSS, SQL, commandes, chemins de fichiers), échappement des données affichées, validation des entrées externes (formulaires, API, fichiers importés, paramètres d'URL) ;
     - autorisations : chaque action vérifie les droits côté serveur, pas seulement dans l'interface ; aucun accès aux données d'un autre utilisateur ; CSRF et CORS si le projet a un serveur ;
     - secrets et données sensibles : rien en clair dans le code, les logs, les messages d'erreur, le stockage local ou les URL ;
     - dépendances ajoutées ou mises à jour : maintenues, licence compatible, sans vulnérabilité connue (`npm audit` ou équivalent [X1]).
   - **Performance** :
     - complexité : boucles imbriquées ou recherches répétées sur des données qui grandissent, appels réseau ou requêtes en boucle (N+1), calculs refaits à chaque rendu ou image ;
     - rendu et fluidité : re-rendus ou recalculs de mise en page inutiles, animations qui tiennent la cadence, travail lourd hors du fil principal ;
     - mobile : CPU, mémoire, réseau lent et batterie ; poids ajouté au bundle ou au chargement (dépendance, image, police), chargement différé quand c'est utile ;
     - objectifs de performance de `docs/specification.md` ou `CLAUDE.md`, s'il y en a, toujours tenus.
   - **Robustesse** : fuites d'écouteurs, de minuteries ou de mémoire, erreurs avalées, états d'erreur et de chargement gérés.
   - **Propreté** : ni code mort, ni `console.log` / débogage, ni TODO orphelin, ni fichier temporaire ou modification sans rapport, ni duplication d'utilitaire.
   - **Tests** : écrits avant le code et vus en échec ? Changement couvert en unitaire **et** e2e (ou vérifié manuellement) ? Échoueraient-ils sans la correction ? Testent-ils le comportement plutôt que l'implémentation ?
   - **Documentation** : `README.md`, `docs/specification.md` et commentaires toujours exacts ?
3. **Points à revoir** : `chemin:ligne`, problème, gravité (**bloquant** : bug, régression, faille ; **important** : cas limite, convention, test manquant, perte de performance notable ; **mineur** : lisibilité, nommage, propreté).
4. **Revue indépendante** [R6] : un sous-agent relecteur qui n'a pas écrit le code relit le même périmètre, sans rien modifier.
   - **Quand** : toujours, sauf changement trivial (quelques lignes, sans logique, ni sécurité, ni performance en jeu) ; dans ce cas, le dire dans le compte rendu.
   - **Brief** : commande exacte du diff, chemin de `CLAUDE.md`, grille de l'étape 2 (section « Revue du travail » de `.claude/skills/project-execute/SKILL.md`). Insister sur la sécurité si le changement touche une zone sensible (authentification, autorisations, entrées externes, données personnelles, dépendances), et sur la performance s'il touche une boucle chaude, le rendu ou le chargement.
   - **Retour** : 30 lignes au plus, un point par ligne au format `chemin:ligne: gravité: problème. correction.` ; « Aucun point » s'il n'y a rien.
   - **Tri** : vérifier chaque point par une lecture ciblée avant de l'accepter. Ajouter les points confirmés à la liste de l'étape 3 ; écarter les faux positifs en notant pourquoi.
5. **Corriger** les bloquants et importants, et les mineurs simples et dans le périmètre. Un point qui demande une décision (comportement, périmètre, compromis) : le soumettre à l'utilisateur. Un point hors périmètre ou non corrigé : le garder pour le compte rendu avec la raison.
6. **Relancer** les vérifications concernées [X1] puis revoir rapidement les corrections. Recommencer tant qu'il reste un point bloquant ou important. Ne relancer la revue indépendante que si les corrections touchent à la logique de façon importante (correction d'un point bloquant).

Revue honnête : si elle ne trouve rien, le dire ; ne pas inventer de points ni en taire.

## Après le travail

Pour chaque tâche traitée sous cette skill [R5] :

- **Toujours** créer une fiche dans `docs/tasks/` (`AAAA-MM-JJ-<slug>.md`, date du jour, sur le modèle des fiches existantes ; créer le dossier au besoin). À défaut de fiche existante :

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

- `docs/specification.md` : mettre à jour si l'architecture, les formats, l'API, le périmètre ou les décisions ont changé, ainsi que les limites connues (retirer une limite levée, ajouter une limite découverte non traitée). Sinon, ne pas y toucher.
- `README.md` : mettre à jour si les commandes, options ou formats documentés ont changé. Sinon, ne pas y toucher.
- `CLAUDE.md` : seulement pour une convention ou un piège durable nouveau.
- Issue référencée : ajouter un commentaire de synthèse [G3] (`add_issue_comment` : ce qui a été fait, vérifications, points restants). Ne pas la fermer d'office.

## Compte rendu

Court, sans recopier le plan ni le code :

- ce qui a été fait (fichiers principaux, en `chemin:ligne` si utile) ;
- vérifications et résultats réels (échecs et non-vérifié compris) ;
- revue : auto-revue et revue indépendante (faite, ou sautée car changement trivial), points corrigés, faux positifs écartés, points ouverts avec la raison, décisions en attente ;
- documents mis à jour ;
- suite possible (committer, pull request avec `project-pullrequest`).

## Proposer de fermer l'issue (si une issue était référencée)

Toujours terminer, juste après le compte rendu, en proposant la fermeture (`AskUserQuestion`). Ne jamais fermer sans accord explicite.

1. **Rappeler l'état réel** dans la question : vérifications en échec ou non faites, points de revue ou « Reste à faire » ouverts. Dans ce cas, recommander de la laisser ouverte.
2. **Options** :
   - **Fermer maintenant** : l'issue est terminée.
   - **Laisser ouverte, fermeture par la pull request** : `Closes #NN` dans la description de la PR (`project-pullrequest`). À recommander si le travail n'est pas encore commité ni fusionné sur `main`.
   - **Laisser ouverte** : travail restant, ou l'utilisateur la fermera lui-même.
3. **Fermer** [G1] : `issue_write` (`state: closed`, `state_reason: completed`) ; statut mis à jour avec le mécanisme utilisé à l'ouverture (option « Done » / « Terminé » / « Closed » du champ ou du projet, ou retrait du label `in-progress` en conservant les autres) ; relire l'issue pour vérifier, et le confirmer en une ligne. En cas d'échec, donner la cause sans prétendre que l'issue est fermée.
4. **Laisser ouverte** : ne rien changer, le statut reste « In Progress ». Si la fermeture passe par la PR, rappeler `Closes #NN`.
