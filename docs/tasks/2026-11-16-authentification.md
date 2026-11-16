# Authentification faite maison (remplace Cloudflare Access)

- Date : 2026-11-16
- Type : fonctionnalité
- Issue : #19

## Demande

Remplacer Cloudflare Access par une authentification et une gestion des utilisateurs faites maison :
login et mot de passe stockés dans D1. Ajout demandé en cours de plan : bannir l'adresse IP après 3
mots de passe faux, réactivable par l'admin.

## Ce qui a été fait

- **core** : `src/common.ts` (`TripId`, `Email`, sortis de `index.ts` pour éviter un import circulaire),
  `src/auth/schemas.ts` (`Password`, `SignupInput`, `LoginInput`, `PasswordChange`, `ResetInput`,
  `InvitationCreate`, `CaptchaAnswer`, `Me`, `isAdminEmail`).
- **Migration `0007_auth.sql`** : `users`, `sessions`, `invitations`, `password_resets`,
  `auth_attempts`, `ip_bans`, `captcha_used`.
- **API** :
  - `src/auth/` : `crypto.ts` (base64url, SHA-256, HMAC, comparaison en temps constant),
    `password.ts` (PBKDF2), `captcha.ts`, `limits.ts` (limites, bannissement), `session.ts`
    (`sessionAuth`, `sameOrigin`, `openSession`, `closeSession`, `clientIp`) ;
  - routes `routes/auth.ts` (publiques et privées), `routes/invitations.ts`, `routes/admin.ts` ;
  - `PUT /members/:email` ne change plus que le rôle d'un membre existant ;
  - `jose`, `ACCESS_*` et `DEV_USER_EMAIL` retirés ; `.dev.vars.example` et `wrangler.jsonc` à jour ;
  - commandes de secours `scripts/reset-link.mjs` et `scripts/unban-ip.mjs` (SQL dans `scripts/sql.mjs`).
- **Web** : client API (`fetchSession`, `setUnauthorizedHandler`, fonctions d'auth, d'invitation et
  d'administration, messages d'erreur), composants `auth/LoginForm`, `auth/PasswordForm`,
  `auth/AdminPanel`, `CopyLink`, `ShareDialog` par invitation, `AppHeader` avec menu du compte ;
  pages `/connexion`, `/compte`, `/invitation/[token]`, `/reinitialisation/[token]`, `/admin` ;
  `lib/auth/next.ts` (page de retour sûre), `lib/auth/session.svelte.ts` ; la déconnexion efface les
  copies hors ligne (`clearOfflineData`).
- **E2E** : projet `setup` (`e2e/auth.setup.ts`) et `storageState`, aides `e2e/auth-helpers.ts`,
  `e2e/auth.spec.ts`, partage de `trips.spec.ts` par lien d'invitation.

## Décisions et pourquoi

- Choix de l'utilisateur (plan validé dans l'issue) : e-mail comme identifiant, PBKDF2, inscription
  libre avec captcha fait maison, partage par lien d'invitation, réinitialisation par l'admin,
  bannissement d'IP.
- **5000 répétitions PBKDF2** : mesuré dans workerd, 5000 ≈ 6,3 ms et 10 000 ≈ 11,3 ms, pour une
  limite de 10 ms de CPU (Worker gratuit).
- **Empreinte factice constante** pour un compte inconnu : la calculer au premier appel doublait le
  coût CPU de la requête.
- **Captcha consommé dès sa première présentation** (même faux) : sinon un robot pourrait essayer
  toutes les réponses avec le même jeton. La réponse n'est pas dans le jeton : elle entre dans la
  signature HMAC.
- **CSRF par comparaison `Origin` / `Host`** (et non avec l'URL de la requête) : derrière le relais de
  Vite, `Host` reste celui du front, comme l'en-tête `Origin`.
- **`400 wrong_password`** pour un mauvais mot de passe actuel : le front renvoie tout `401
unauthorized` vers la connexion.
- **Tests d'API existants** : identité toujours injectée (`createApp({ auth })`), en-tête `Origin`
  ajouté par `call()`, membres insérés directement par `addMember()`. Les nouveaux tests passent par la
  vraie session (`test/auth-helpers.ts`), chacun avec sa propre IP fictive.
- **Commandes de secours** : wrangler lancé par `node` sans shell (`d1.mjs`) ; avec `shell: true` sous
  Windows, les arguments (le SQL) seraient concaténés sans échappement. `RETURNING` pour savoir si le
  compte existe : `wrangler d1 execute --local --json` ne renvoie pas `meta.changes`.
- **Déconnexion = effacement des copies hors ligne** : elles appartiennent au compte.

## Bugs et pièges rencontrés

- Import circulaire `auth/schemas` → `index` (pour `Email`) : réglé par `common.ts`.
- **`wrangler dev` laisse passer `CF-Connecting-IP`** envoyé par le client (vérifié) : les e2e s'en
  servent pour isoler bannissements et limites. En production, Cloudflare le remplace.
- **`browser.newContext()` hérite du `storageState` du projet** : pour un autre utilisateur, passer
  `storageState: { cookies: [], origins: [] }` (`anonymousContext`).
- E2E : après « Se déconnecter », attendre l'URL `/connexion` avant de remplir le formulaire, sinon la
  redirection de déconnexion efface la saisie.
- Les heredocs Bash de cette machine perdent des barres obliques inverses et cassent sur certains
  contenus : écrire les fichiers avec l'outil d'écriture.

## Tests et vérifications

- core : 7 tests de schémas (`auth/schemas.test.ts`).
- API : `test/auth.test.ts` (mots de passe, captcha, inscription, connexion, bannissement, sessions,
  CSRF), `test/invitations.test.ts`, `test/admin.test.ts` (admin, réinitialisation, SQL des commandes
  de secours) ; tests existants adaptés (membres, `me`).
- Web : client API, `ShareDialog`, `AppHeader`, `LoginForm`, `PasswordForm`, `AdminPanel`,
  `lib/auth/next`.
- E2E : `auth.spec.ts` (retour après connexion, inscription/déconnexion/connexion, bannissement et
  réactivation, réinitialisation par l'admin, changement de mot de passe), partage par invitation.
- Commandes de secours essayées sur la base locale (`--local`).
- Suites complètes : lint et typecheck propres ; unitaires core 220, API 170, web 216 ; build ;
  e2e 39/39 avec `--workers=1`. En parallèle, la machine chargée faisait dépasser les délais
  (23 échecs par délai, dont des tests sans rapport, et le smoke du service worker déjà instable).
- Non vérifié : production (bascule à faire), consommation CPU réelle du Worker.

## Revue

- `d1.mjs` cassé sous Windows (`shell: true`) : corrigé.
- Empreinte factice calculée à la volée (≈ 12 ms au premier appel) : remplacée par une constante.
- Course dans deux e2e après déconnexion : corrigée.
- Laissé ouvert : deux PBKDF2 par requête pour le changement de mot de passe (≈ 12 ms), noté dans les
  limites de la spécification.

## Reste à faire

- Bascule en production avec l'utilisateur : `AUTH_SECRET`, `ADMIN_EMAILS`, migration `0007`,
  déploiement, création du compte, vérifications manuelles, suppression de l'application Access.
