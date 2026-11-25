# Modèles, effort et délégation

Règles communes aux skills `project-plan` et `project-execute`, appliquées à toutes leurs étapes ; `project-pullrequest` n'en applique que la section « Outils d'économie, si disponibles ». But : **consommer le moins de tokens possible** tout en faisant **toujours la réflexion avec Opus en effort high**.

## Session principale

- La session principale porte **toute la réflexion** (catégories R1 à R5 ci-dessous) : elle a déjà le contexte de la tâche, alors qu'un sous-agent repart de zéro et devrait tout relire. Seule exception : la revue indépendante [R6], où le regard neuf est justement le but.
- Elle doit tourner sur **Opus** (ou un modèle supérieur, ex. Fable) en **effort high**.
- Une session ne peut changer ni son propre modèle ni son effort. Au lancement, si le modèle est inférieur à Opus (Sonnet, Haiku) ou si l'effort connu est inférieur à high, le signaler en une ligne et demander à l'utilisateur de changer dans le menu des modèles avant l'analyse. Si l'effort n'est pas connu, ne rien signaler.

## Quand déléguer à un sous-agent

Un sous-agent (`Agent`) sert de **filtre à tokens**. Déléguer seulement quand les trois conditions sont réunies :

- la sortie brute est volumineuse (sortie de tests ou de build, captures d'écran, JSON GitHub, recherche dans de nombreux fichiers) ;
- le résultat utile est court ;
- aucune réflexion n'est demandée : le sous-agent exécute et trie, il ne décide rien (sauf la revue indépendante [R6], confiée à un sous-agent Opus high).

Ne pas déléguer :

- une commande courte (`git status`, `git branch`, une lecture d'issue…) : la délégation coûte plus qu'elle ne rapporte ;
- une écriture dont le texte est déjà rédigé (corps d'issue, commentaire) : le brief devrait le recopier, sans aucun gain ;
- tout ce qui demande le contexte de la tâche pour juger.

Lancer dans le même message les délégations indépendantes. Si l'outil `Agent` n'est pas disponible, tout faire dans la session principale.

## Catégories de travail

| Code | Travail | Qui | Modèle / effort |
|---|---|---|---|
| **R1** | Analyse de la demande, conception, plan, doutes et options | principal | Opus high |
| **R2** | Écriture des tests et du code, remaniement | principal | Opus high |
| **R3** | Diagnostic : cause racine, interprétation d'un test ou d'un build en échec | principal | Opus high |
| **R4** | Revue finale | principal | Opus high |
| **R5** | Rédaction : issue, fiche `docs/tasks/`, spécification, README, compte rendu | principal | Opus high |
| **R6** | Revue indépendante du diff (bugs, sécurité, performance, bonnes pratiques), sans rien modifier | sous-agent relecteur | `opus`, `high` |
| **E1** | Repérage : où est défini X, qui appelle Y, utilitaires existants | sous-agent `Explore` | `haiku`, `low` |
| **E2** | Pièges et décisions passées dans `docs/tasks/` liés à la demande (plus de 3 fiches à parcourir) | sous-agent `Explore` | `sonnet`, `medium` |
| **X1** | Lancement des tests (y compris « voir échouer » en TDD), du build, du lint, du typecheck | sous-agent | `haiku`, `low` |
| **X2** | Vérifier sur la branche principale, dans un worktree séparé, si un échec existait déjà | sous-agent | `haiku`, `low` |
| **X3** | Vérification dans l'application réelle (navigateur, captures d'écran) selon un scénario précis | sous-agent | `sonnet`, `medium` |
| **X4** | Installation de l'outillage de test ou d'une dépendance validée | sous-agent | `haiku`, `low` |
| **G1** | Statut d'issue « In Progress » / « Done » (plusieurs étapes, JSON verbeux) et sa vérification | sous-agent | `haiku`, `low` |
| **G2** | Lecture d'une issue et de ses commentaires (c'est la définition de la tâche) | principal, en direct | — |
| **G3** | Création ou mise à jour d'une issue, commentaire : texte déjà rédigé | principal, en direct | — |
| **G4** | `git status`, `branch`, `remote`, `log`, `diff --stat`, worktree, toute commande courte | principal, en direct | — |

Une suite de tests très courte (quelques lignes de sortie) peut être lancée en direct.

## Brief et retour du sous-agent

Brief en quatre lignes :

1. **Objectif** : ce qui doit être obtenu.
2. **Opérations** : commandes, chemins et valeurs exacts, dans l'ordre.
3. **Retour attendu** : format précis (voir ci-dessous).
4. **Arrêt** : sur tout imprévu (erreur inattendue, conflit, droit insuffisant, issue fermée), s'arrêter et le rapporter, sans corriger ni décider.

Sous `project-plan`, le brief rappelle aussi la règle de lecture seule.

Retour : **30 lignes au plus**, sans commentaire ni recommandation. Erreurs décisives citées mot pour mot, emplacements en `chemin:ligne`. Pour des tests : commande, code de sortie, compteurs, nom de chaque test en échec avec sa ligne d'erreur décisive.

Si un point du retour doit être confirmé, l'agent principal fait une lecture ciblée plutôt que de refaire le travail.

## Économies générales

- **Lectures ciblées** : chercher d'abord (`Grep`), puis lire seulement la plage utile (`Read` avec `offset`/`limit`). Lire la spécification par sections, titres d'abord. Ne jamais relire un fichier déjà lu dans la conversation, sauf s'il a changé.
- **Sorties courtes** : reporters de tests concis (ex. `--reporter=dot`, `--quiet`), `git diff --stat` avant le diff complet, `gh … --json <champs utiles>`.
- **Pas de répétition** : ne pas recopier dans les messages le plan, le code ou un fichier déjà montré. Compte rendu court.

## Compactage du contexte

Le compactage automatique reste activé comme filet de sécurité, mais son résumé perd des détails (erreurs exactes, points de revue en cours, réponses de l'utilisateur, tests en échec).

- **Compacter de préférence à la main aux transitions naturelles**, avec une consigne sur ce qu'il faut garder : par exemple après la validation du plan, avant de lancer `project-execute` (`/compact garde l'issue, la branche, les décisions`), ou après les vérifications, avant la revue. Le proposer à l'utilisateur en une ligne quand la conversation est longue ; ne pas compacter au milieu d'une étape (entre « voir échouer » et « implémenter », pendant la revue).
- **Après un compactage** (le contexte commence par un résumé de la conversation) :
  - ne plus considérer comme lus les fichiers lus avant : relire par lectures ciblées ce dont l'étape en cours a besoin. Les règles « ne pas relire le contexte déjà chargé » et « ne jamais relire un fichier déjà lu » ne s'appliquent qu'au contenu encore présent dans la conversation ;
  - reprendre le plan et les décisions depuis leur source durable (section « Plan » de l'issue GitHub, fiche `docs/tasks/`), pas depuis le résumé ;
  - relancer [X1] pour connaître l'état réel des tests plutôt que se fier au résumé ;
  - vérifier la branche et l'état du dépôt [G4] avant toute écriture.

## Outils d'économie, si disponibles

Ces outils ne sont pas requis : sans eux, les règles ci-dessus s'appliquent seules. Leur présence se déduit du contexte de la session (consignes, messages des hooks), sans lancer de commande ni lire de fichier de configuration. Un outil absent ou désactivé est ignoré sans le signaler : ne jamais l'installer, ni activer son plugin ou son hook, à la place de l'utilisateur.

**RTK** (sorties de commandes condensées, signalé par les consignes de la session) :

- lancer les commandes normalement, sans préfixe `rtk` : le hook les réécrit ;
- passer par l'outil `Bash` plutôt que `PowerShell` quand le hook ne réécrit que les commandes `Bash` ;
- traiter la sortie condensée comme complète ;
- n'utiliser `rtk bypass <cmd>` que si la sortie est inexploitable (vide alors qu'un résultat était attendu, contradictoire avec le code de sortie, illisible) ;
- [X1] : une suite dont la sortie condensée reste courte se lance en direct, sans sous-agent.

**Caveman** (style de réponse compressé, signalé par le mode actif de la session, ex. message `CAVEMAN MODE ACTIVE` d'un hook) :

- ne pas charger la skill `caveman:caveman` si le mode n'est pas actif : l'utilisateur l'a peut-être coupé (« stop caveman », « normal mode ») ;
- les messages du chat suivent le style caveman, dans la langue de réponse demandée par l'utilisateur ;
- les questions posées à l'utilisateur restent en phrases complètes ;
- tout ce qui est persisté reste en prose normale et complète : issue et commentaires GitHub, fiche `docs/tasks/`, spécification, `README.md`, `CLAUDE.md`, code et commentaires du code, messages de commit, description de pull request ;
- [E1] : utiliser le sous-agent `caveman:cavecrew-investigator` (retour compressé en `chemin:ligne`) à la place d'`Explore`, toujours avec `haiku`, `low` ;
- [R6] : utiliser le sous-agent `caveman:cavecrew-reviewer` (une ligne par point, gravité en tête) comme relecteur, toujours avec `opus`, `high` ;
- les briefs demandent aux sous-agents un retour au format caveman, en gardant mot pour mot les erreurs, commandes et chemins.
