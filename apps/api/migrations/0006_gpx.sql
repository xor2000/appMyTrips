-- Lot 6 : randonnées GPX (sans stockage du fichier original : R2 n'est pas activé).

-- Statistiques (JSON : distanceM, ascentM, descentM, minEle, maxEle, isLoop, pointCount).
ALTER TABLE steps ADD COLUMN gpx_stats TEXT;
-- Tracé simplifié (JSON : [[lat, lng, ele|null], …], 500 points au plus).
ALTER TABLE steps ADD COLUMN gpx_track TEXT;
-- Durée avec le dénivelé (+1 h par 600 m de D+).
ALTER TABLE steps ADD COLUMN use_elevation INTEGER NOT NULL DEFAULT 0;
-- Durée saisie à la main : non recalculée depuis le GPX.
ALTER TABLE steps ADD COLUMN duration_manual INTEGER NOT NULL DEFAULT 0;
