-- Couleur choisie d'un trajet : rang dans la palette des trajets (0 à 7). NULL : automatique
-- (chaque trajet du jour prend la couleur qui suit celle du précédent).
ALTER TABLE legs ADD COLUMN color INTEGER CHECK (color BETWEEN 0 AND 7);
