---
name: project-pullrequest
description: Crée une pull request GitHub pour la branche courante de ce projet, toujours vers main. Échoue immédiatement si la branche courante est déjà main. Utiliser quand l'utilisateur demande d'ouvrir/créer une pull request pour ce projet.
---

# Pull request

## Garde-fou : branche courante (à vérifier en premier)

Avant toute autre étape, vérifier la branche courante : `git branch --show-current`.

**Si la branche courante est `main`, arrêter immédiatement cette skill** et le signaler à l'utilisateur — il n'y a rien à proposer en pull request depuis la branche cible elle-même. Ne pas créer de branche à la place de l'utilisateur ni continuer sans qu'il ait tranché ; lui demander s'il veut d'abord créer/basculer sur une branche de travail.

## Branche cible

La branche cible d'une pull request dans ce dépôt est toujours **`main`** (`gh pr create --base main`) — ne jamais proposer ni utiliser une autre base.

## Étapes

1. **État de la branche** (en parallèle) : `git status` (fichiers non trackés inclus, jamais `-uall`), `git diff` (indexé et non indexé), et l'historique divergé depuis `main` — `git log main..HEAD` + `git diff main...HEAD` — pour analyser **tous** les commits qui partiront dans la PR, pas seulement le dernier. Si des changements non commités existent encore, demander à l'utilisateur s'ils doivent être inclus avant de continuer (ne pas les committer d'office).
2. **Vérifications avant publication** : lint, typecheck, tests unitaires et e2e des parties du projet touchées par la branche (voir `CLAUDE.md` / `README.md` et la skill `project-execute` pour le détail des commandes) — ne pas ouvrir de PR sur une régression connue ou un état non vérifié.
3. **Chercher un template de PR** : `pull_request_template.md` à la racine ou `.github/PULL_REQUEST_TEMPLATE/` — l'utiliser pour structurer la description s'il est présent ; sinon, repli sur le format Résumé (bullet points, le « pourquoi » plutôt que le « quoi ») + Plan de test (checklist markdown).
4. **Issues liées** : repérer les issues GitHub traitées par la branche, dans cet ordre de sources :
   - la demande de l'utilisateur et la conversation (issue référencée lors de la skill `project-execute` ou `project-plan`) ;
   - le nom de la branche (ex. `fix/12-…`, `feat/issue-12`) et les messages des commits `git log main..HEAD` (`#12`, lien d'issue) ;
   - le champ « Issue » des entrées `docs/tasks/` ajoutées ou modifiées par la branche.

   Pour chaque issue trouvée, vérifier qu'elle existe et son état (`issue_read`), puis ajouter une ligne dans la description de la PR, dans une section « Issues liées » :
   - **`Closes #NN`** si la branche la traite entièrement : GitHub la fermera automatiquement à la fusion dans `main`. Une ligne par issue (`Closes #12`, `Closes #15`) : `Closes #12, #15` ne ferme que la première.
   - **`Refs #NN`** si la branche ne la traite qu'en partie, ou si l'issue est déjà fermée : elle est liée sans être fermée.
   - Pour une issue d'un autre dépôt, écrire la référence complète : `Closes <owner>/<repo>#NN`.

   En cas de doute (issue devinée seulement d'après le nom de la branche, traitement partiel ou complet), demander à l'utilisateur plutôt que de risquer de fermer la mauvaise issue. Si aucune issue n'est trouvée, ne rien ajouter.
5. **Pousser la branche** si elle n'est pas encore sur `origin` ou en retard : `git push -u origin <branche>`.
6. **Créer la PR** : `gh pr create --base main --title "..." --body "$(cat <<'EOF' ... EOF)"` — titre court (moins de 70 caractères), description au format de l'étape 3 avec la section « Issues liées » de l'étape 4, terminée par les lignes d'attribution demandées par le rappel système de la conversation si présent. Si la CLI `gh` n'est pas disponible, utiliser l'outil GitHub `create_pull_request` (base `main`) avec le même titre et la même description.
7. Retourner l'URL de la PR créée à l'utilisateur, en indiquant les issues qui seront fermées à la fusion (`Closes`) et celles qui sont seulement liées (`Refs`).

## Règles générales

- Ne jamais utiliser `--no-verify`, `--no-gpg-sign`, ni contourner un hook qui échoue — corriger le problème sous-jacent puis recommencer.
- Ne jamais forcer un push (`--force`) sans demande explicite de l'utilisateur.
- Ne pas committer de fichier suspect (secrets, `.env`, identifiants) même repéré tardivement dans le diff — prévenir l'utilisateur plutôt que de l'inclure.
- Ne pas utiliser les outils `TaskCreate`/`Agent` pour cette tâche.
- Si un point de la PR reste ambigu (titre, périmètre à inclure, branche de base à créer), demander à l'utilisateur plutôt que deviner.
