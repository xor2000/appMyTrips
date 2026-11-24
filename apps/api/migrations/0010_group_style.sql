-- Style d'un dossier (jours ou idées) : icône (type d'étape, NULL : icône dossier) et couleur
-- (rang dans la palette des trajets, 0 à 7 ; NULL : couleur d'accent). Réservés aux dossiers.
ALTER TABLE steps ADD COLUMN icon TEXT;
ALTER TABLE steps ADD COLUMN color INTEGER CHECK (color BETWEEN 0 AND 7);
