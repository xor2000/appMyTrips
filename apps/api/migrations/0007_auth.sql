-- Authentification faite maison : comptes, sessions, invitations, limites et bannissements.

-- Comptes : l'e-mail (en minuscules) est l'identifiant, comme dans trips.owner_email et
-- trip_members.email.
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  -- Format versionné : pbkdf2-sha256$<itérations>$<sel>$<empreinte> (base64url).
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Sessions : seule l'empreinte SHA-256 du jeton du cookie est stockée.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users (email) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_email ON sessions (email);

-- Liens d'invitation à un voyage : à usage unique, stockés hachés.
CREATE TABLE invitations (
  token_hash TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT
);

CREATE INDEX invitations_trip ON invitations (trip_id);

-- Liens de réinitialisation du mot de passe, générés par un admin.
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users (email) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Tentatives comptées pour les limites : échecs de connexion et inscriptions.
CREATE TABLE auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('login_failure', 'signup')),
  ip TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX auth_attempts_ip ON auth_attempts (kind, ip, created_at);
CREATE INDEX auth_attempts_email ON auth_attempts (kind, email, created_at);

-- Adresses IP bannies (3 échecs de connexion en 15 minutes), jusqu'à réactivation par un admin.
CREATE TABLE ip_bans (
  ip TEXT PRIMARY KEY,
  banned_at TEXT NOT NULL,
  last_email TEXT,
  failures INTEGER NOT NULL
);

-- Captchas déjà présentés (usage unique), gardés jusqu'à leur expiration.
CREATE TABLE captcha_used (
  id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
