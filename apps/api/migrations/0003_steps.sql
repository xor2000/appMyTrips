-- Lot 2 : étapes (et dossiers) et séjours.

CREATE TABLE steps (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  -- NULL = liste d'idées (étape pas encore placée dans un jour).
  day_id TEXT REFERENCES days (id) ON DELETE SET NULL,
  -- Dossier parent (un seul niveau d'imbrication).
  parent_id TEXT REFERENCES steps (id) ON DELETE CASCADE,
  -- Clé d'ordre fractionnaire parmi les frères (même jour, même parent).
  position TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('step', 'group')),
  type TEXT,
  name TEXT NOT NULL,
  lat REAL,
  lng REAL,
  address TEXT,
  -- Point de sortie (randonnée…) ; NULL = identique au point d'entrée.
  exit_lat REAL,
  exit_lng REAL,
  duration_min INTEGER NOT NULL DEFAULT 0,
  fixed_start TEXT,
  timezone TEXT,
  opening_hours TEXT,
  osm_ref TEXT,
  booking_ref TEXT,
  booking_url TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX steps_trip ON steps (trip_id);
CREATE INDEX steps_day ON steps (day_id);
CREATE INDEX steps_parent ON steps (parent_id);

CREATE TABLE stays (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT,
  check_in_date TEXT NOT NULL,
  check_in_time TEXT NOT NULL DEFAULT '17:00',
  check_out_date TEXT NOT NULL,
  check_out_time TEXT NOT NULL DEFAULT '10:00',
  booking_ref TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX stays_trip ON stays (trip_id);
