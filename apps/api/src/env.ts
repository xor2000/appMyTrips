/** Bindings et variables du Worker (voir wrangler.jsonc). */
export interface Bindings {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  /** Domaine d'équipe Cloudflare Access, ex. « mytrips.cloudflareaccess.com ». */
  ACCESS_TEAM_DOMAIN?: string;
  /** Audience (AUD) de l'application Access. Sa présence désactive DEV_USER_EMAIL. */
  ACCESS_AUD?: string;
  /** Développement local uniquement : e-mail utilisé sans JWT quand ACCESS_AUD est absent. */
  DEV_USER_EMAIL?: string;
}
