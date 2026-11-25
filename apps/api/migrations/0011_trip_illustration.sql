-- Illustrations dessinées à la place des photos Wikimedia Commons : le voyage n'enregistre plus
-- que l'identifiant de son illustration (NULL : suggérée à l'affichage d'après le nom et les lieux).
-- Les photos existantes ne sont pas converties : ces voyages reçoivent la suggestion.
ALTER TABLE trips ADD COLUMN illustration TEXT;
ALTER TABLE trips DROP COLUMN cover;
DROP TABLE cover_cache;
