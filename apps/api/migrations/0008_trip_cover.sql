-- Page d'accueil illustrée : photo de couverture des voyages (Wikimedia Commons).

-- Photo du voyage (JSON : url, thumbUrl, author, license, sourceUrl), NULL s'il n'y en a pas.
ALTER TABLE trips ADD COLUMN cover TEXT;

-- Cache des recherches de photos sur Commons, par mots-clés normalisés.
CREATE TABLE cover_cache (
  query TEXT PRIMARY KEY,
  -- Photos trouvées (JSON, tableau de TripCover ; éventuellement vide).
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
