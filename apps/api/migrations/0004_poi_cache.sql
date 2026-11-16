-- Lot 3 : cache des lieux de la découverte (Overpass / Geoapify), par catégorie et case de carte.

CREATE TABLE poi_cache (
  -- « <catégorie>:<zoom>:<x>:<y> » (case du schéma slippy map).
  key TEXT PRIMARY KEY,
  -- Lieux normalisés (JSON, tableau de Poi).
  payload TEXT NOT NULL,
  -- Fournisseur qui a répondu : overpass | geoapify.
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
