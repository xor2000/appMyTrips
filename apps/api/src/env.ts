/** Bindings et variables du Worker (voir wrangler.jsonc). */
export interface Bindings {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Domaine d'équipe Cloudflare Access, ex. « mytrips.cloudflareaccess.com ». */
  ACCESS_TEAM_DOMAIN?: string;
  /** Audience (AUD) de l'application Access. Sa présence désactive DEV_USER_EMAIL. */
  ACCESS_AUD?: string;
  /** URL du service Photon (géocodage) ; défaut https://photon.komoot.io. */
  PHOTON_URL?: string;
  /** Clé OpenRouteService (secret) ; sans elle, voiture, vélo et marche sont estimés. */
  ORS_API_KEY?: string;
  /** URL de base d'OpenRouteService ; défaut https://api.heigit.org/openrouteservice. */
  ORS_URL?: string;
  /** URL de base de Transitous ; défaut https://api.transitous.org. */
  TRANSITOUS_URL?: string;
  /** URL de contact du projet, ajoutée au User-Agent du routage (politique de Transitous). */
  CONTACT_URL?: string;
  /** Instances Overpass, séparées par des virgules, essayées dans l'ordre (défaut : deux publiques). */
  OVERPASS_URLS?: string;
  /** Clé Geoapify (secret) : secours de la découverte de lieux si Overpass échoue. */
  GEOAPIFY_API_KEY?: string;
  /** URL de l'API Places de Geoapify ; défaut https://api.geoapify.com. */
  GEOAPIFY_URL?: string;
  /** Développement local uniquement : e-mail utilisé sans JWT quand ACCESS_AUD est absent. */
  DEV_USER_EMAIL?: string;
}
