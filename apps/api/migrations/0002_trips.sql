-- Lot 1 : voyages, membres (partage) et jours.

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  day_start TEXT NOT NULL DEFAULT '08:00',
  day_end TEXT NOT NULL DEFAULT '22:00',
  default_timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  hike_speed_kmh REAL NOT NULL DEFAULT 3.5,
  -- Verrou optimiste : incrémenté à chaque modification d'un objet du voyage.
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX trips_owner_email ON trips (owner_email);

CREATE TABLE trip_members (
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, email)
);

CREATE INDEX trip_members_email ON trip_members (email);

CREATE TABLE days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  -- Heures propres au jour ; NULL = heures du voyage.
  day_start TEXT,
  day_end TEXT,
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (trip_id, date)
);
