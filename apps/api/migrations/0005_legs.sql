-- Lot 4 : trajets entre deux points consécutifs d'un jour, et cache des itinéraires.

CREATE TABLE legs (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  -- Clé d'étape, ou d'occurrence de séjour (« stay:<id>:<date>:start|end »).
  from_key TEXT NOT NULL,
  to_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('car', 'bike', 'walk', 'bus', 'train', 'plane', 'ferry')),
  -- NULL : distance inconnue (aucun itinéraire, durée saisie).
  distance_m INTEGER,
  duration_min INTEGER NOT NULL,
  distance_source TEXT NOT NULL CHECK (distance_source IN ('router', 'estimate', 'manual')),
  duration_source TEXT NOT NULL CHECK (duration_source IN ('router', 'estimate', 'manual')),
  -- Polyligne encodée (précision 5).
  geometry TEXT,
  -- Lignes empruntées (bus, train), ex. « TER 17611 → Bus 3 ».
  summary TEXT,
  -- Heure de départ fixée (HH:mm), ex. train réservé.
  depart_at TEXT,
  booking_ref TEXT,
  notes TEXT NOT NULL DEFAULT '',
  computed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (trip_id, from_key, to_key)
);

CREATE INDEX legs_trip ON legs (trip_id);

CREATE TABLE route_cache (
  -- « <mode>:<lat>,<lng>><lat>,<lng>[:<tranche horaire>] », points arrondis à 5 décimales.
  key TEXT PRIMARY KEY,
  -- RouteResult (JSON).
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
