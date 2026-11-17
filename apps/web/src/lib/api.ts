import type {
  BatchOp,
  GpxData,
  Bbox,
  Me,
  DayPatch,
  LegCreate,
  LegPatch,
  Place,
  Poi,
  PoiCategory,
  Role,
  StayCreate,
  StayPatch,
  StepCreate,
  StepPatch,
  TripCreate,
  TripPatch,
  TripSnapshot,
  TripSummary,
  WikiSummary,
  TripCover,
} from '@mytrips/core';

import type { z } from 'zod';

type Fetcher = typeof fetch;

const MESSAGES: Record<string, string> = {
  version_conflict: 'Le voyage a été modifié entre-temps : il vient d’être rechargé.',
  version_required: 'La version du voyage manque : rechargez la page.',
  days_not_empty: 'Des jours à supprimer contiennent des informations.',
  forbidden: 'Vous n’avez pas le droit de faire cette modification.',
  not_found: 'Voyage introuvable.',
  invalid: 'Certaines informations sont invalides.',
  invalid_email: 'Adresse e-mail invalide.',
  invalid_day: 'Ce jour n’appartient pas au voyage.',
  invalid_parent: 'Une étape ne peut être rangée que dans un dossier du même jour.',
  children_mode_required: 'Indiquez ce que deviennent les étapes du dossier.',
  geocoder_unavailable: 'La recherche de lieux est indisponible pour le moment.',
  zoom_too_low: 'Zoomez pour explorer.',
  area_too_large: 'Zone trop grande : zoomez pour explorer.',
  poi_unavailable: 'La découverte de lieux est indisponible pour le moment. Réessayez plus tard.',
  wiki_unavailable: 'Wikipédia ne répond pas pour le moment.',
  no_route: 'Aucun itinéraire trouvé : indiquez la durée à la main.',
  invalid_leg: 'Ces deux étapes ne se suivent plus : le jour a changé entre-temps.',
  owner_cannot_be_member: 'Le propriétaire a déjà tous les droits sur ce voyage.',
  unauthorized: 'Session expirée : reconnectez-vous.',
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  ip_banned:
    'Trop de mots de passe faux depuis cette adresse : elle est bloquée. Demandez à l’administrateur de la réactiver.',
  too_many_attempts: 'Trop de tentatives : réessayez dans quelques minutes.',
  invalid_captcha: 'Réponse au calcul incorrecte ou expirée : une nouvelle question est posée.',
  email_taken: 'Un compte existe déjà avec cet e-mail.',
  wrong_password: 'Mot de passe actuel incorrect.',
  invalid_link: 'Ce lien n’est plus valable (déjà utilisé ou expiré).',
  invalid_invitation: 'Cette invitation n’est plus valable (déjà utilisée ou expirée).',
  already_owner: 'Vous êtes déjà propriétaire de ce voyage.',
  not_member: 'Cette personne n’est pas membre du voyage.',
  unknown_user: 'Aucun compte avec cet e-mail.',
  bad_origin: 'Requête refusée : rechargez la page.',
  auth_not_configured: 'L’authentification n’est pas configurée sur le serveur.',
};

let onUnauthorized: (() => void) | null = null;

/** Appelé quand l'API répond « session absente ou expirée » (renvoi vers la connexion). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/** Erreur renvoyée par l'API, avec son statut HTTP, son code et son corps. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: Record<string, unknown>,
  ) {
    super(MESSAGES[code] ?? `Erreur du serveur (${status}).`);
    this.name = 'ApiError';
  }
}

async function request<T>(fetcher: Fetcher, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const res = await fetcher(path, { ...init, headers });
  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      // Corps absent ou non JSON : le statut suffit.
    }
    const code = typeof body.error === 'string' ? body.error : `http_${res.status}`;
    if (res.status === 401 && code === 'unauthorized') onUnauthorized?.();
    throw new ApiError(res.status, code, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** État de la session : connecté, non connecté (401), ou inconnu (hors ligne, API muette). */
export type SessionState =
  { state: 'signed-in'; me: Me } | { state: 'signed-out' } | { state: 'unknown' };

export async function fetchSession(fetcher: Fetcher = fetch): Promise<SessionState> {
  try {
    const body = await request<Partial<Me>>(fetcher, '/api/me');
    if (typeof body?.email === 'string') {
      return { state: 'signed-in', me: { email: body.email, isAdmin: body.isAdmin === true } };
    }
    return { state: 'unknown' };
  } catch (e) {
    return e instanceof ApiError && e.status === 401
      ? { state: 'signed-out' }
      : { state: 'unknown' };
  }
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** Question de calcul (captcha) à poser à l'inscription. */
export function getCaptcha(fetcher: Fetcher = fetch): Promise<{ question: string; token: string }> {
  return request(fetcher, '/api/auth/captcha');
}

export function signup(
  email: string,
  password: string,
  captcha: { token: string; answer: string },
  fetcher: Fetcher = fetch,
): Promise<Me> {
  return request(fetcher, '/api/auth/signup', post({ email, password, captcha }));
}

export function login(email: string, password: string, fetcher: Fetcher = fetch): Promise<Me> {
  return request(fetcher, '/api/auth/login', post({ email, password }));
}

export function logout(fetcher: Fetcher = fetch): Promise<void> {
  return request(fetcher, '/api/auth/logout', post());
}

export function changePassword(
  current: string,
  next: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  return request(fetcher, '/api/auth/password', post({ current, next }));
}

export function resetPassword(
  token: string,
  password: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  return request(fetcher, `/api/auth/reset/${encodeURIComponent(token)}`, post({ password }));
}

export interface InvitationLink {
  token: string;
  role: Role;
  expiresAt: string;
}

export interface InvitationPreview {
  tripId: string;
  tripName: string;
  ownerEmail: string;
  role: Role;
}

export function createInvitation(
  tripId: string,
  role: Role,
  fetcher: Fetcher = fetch,
): Promise<InvitationLink> {
  return request(fetcher, `/api/trips/${tripId}/invitations`, post({ role }));
}

export function getInvitation(token: string, fetcher: Fetcher = fetch): Promise<InvitationPreview> {
  return request(fetcher, `/api/invitations/${encodeURIComponent(token)}`);
}

export function acceptInvitation(
  token: string,
  fetcher: Fetcher = fetch,
): Promise<{ tripId: string }> {
  return request(fetcher, `/api/invitations/${encodeURIComponent(token)}/accept`, post());
}

export interface IpBan {
  ip: string;
  bannedAt: string;
  lastEmail: string | null;
  failures: number;
}

export function adminCreateReset(
  email: string,
  fetcher: Fetcher = fetch,
): Promise<{ token: string; expiresAt: string }> {
  return request(fetcher, '/api/admin/resets', post({ email }));
}

export async function adminListBans(fetcher: Fetcher = fetch): Promise<IpBan[]> {
  return (await request<{ bans: IpBan[] }>(fetcher, '/api/admin/bans')).bans;
}

export function adminUnban(ip: string, fetcher: Fetcher = fetch): Promise<void> {
  return request(fetcher, `/api/admin/bans/${encodeURIComponent(ip)}`, { method: 'DELETE' });
}

export async function listTrips(fetcher: Fetcher = fetch): Promise<TripSummary[]> {
  return (await request<{ trips: TripSummary[] }>(fetcher, '/api/trips')).trips;
}

export function createTrip(
  input: Pick<TripCreate, 'name' | 'startDate' | 'endDate'> & Partial<TripCreate>,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, '/api/trips', { method: 'POST', body: JSON.stringify(input) });
}

export function getTrip(id: string, fetcher: Fetcher = fetch): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${id}`);
}

export function updateTrip(
  id: string,
  version: number,
  patch: TripPatch,
  options: { force?: boolean } = {},
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  const query = options.force ? '?force=true' : '';
  return request(fetcher, `/api/trips/${id}${query}`, {
    method: 'PATCH',
    headers: { 'if-match': String(version) },
    body: JSON.stringify(patch),
  });
}

export function updateDay(
  id: string,
  dayId: string,
  version: number,
  patch: DayPatch,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${id}/days/${dayId}`, {
    method: 'PATCH',
    headers: { 'if-match': String(version) },
    body: JSON.stringify(patch),
  });
}

export function deleteTrip(id: string, fetcher: Fetcher = fetch): Promise<void> {
  return request(fetcher, `/api/trips/${id}`, { method: 'DELETE' });
}

export function putMember(
  id: string,
  email: string,
  role: Role,
  fetcher: Fetcher = fetch,
): Promise<void> {
  return request(fetcher, `/api/trips/${id}/members/${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export function deleteMember(id: string, email: string, fetcher: Fetcher = fetch): Promise<void> {
  return request(fetcher, `/api/trips/${id}/members/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
}

/** Données d'entrée d'une étape, avant application des valeurs par défaut. */
export type StepInput = z.input<typeof StepCreate>;

function versioned(version: number, method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'if-match': String(version) },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function createStep(
  tripId: string,
  version: number,
  step: StepInput,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/steps`, versioned(version, 'POST', step));
}

export function updateStep(
  tripId: string,
  stepId: string,
  version: number,
  patch: StepPatch,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(
    fetcher,
    `/api/trips/${tripId}/steps/${stepId}`,
    versioned(version, 'PATCH', patch),
  );
}

/** Supprime une étape ; pour un dossier non vide, `children` dit si ses étapes sont gardées. */
export function deleteStep(
  tripId: string,
  stepId: string,
  version: number,
  children?: 'keep' | 'delete',
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  const query = children ? `?children=${children}` : '';
  return request(
    fetcher,
    `/api/trips/${tripId}/steps/${stepId}${query}`,
    versioned(version, 'DELETE'),
  );
}

export function createStay(
  tripId: string,
  version: number,
  stay: z.input<typeof StayCreate>,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/stays`, versioned(version, 'POST', stay));
}

export function updateStay(
  tripId: string,
  stayId: string,
  version: number,
  patch: StayPatch,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(
    fetcher,
    `/api/trips/${tripId}/stays/${stayId}`,
    versioned(version, 'PATCH', patch),
  );
}

export function deleteStay(
  tripId: string,
  stayId: string,
  version: number,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/stays/${stayId}`, versioned(version, 'DELETE'));
}

/** Recherche de lieux (Photon via l'API), biaisée vers `near` (centre de la carte). */
export async function searchPlaces(
  q: string,
  near: { lat: number; lng: number } | null,
  fetcher: Fetcher = fetch,
): Promise<Place[]> {
  const params = new URLSearchParams({ q });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lng', String(near.lng));
  }
  return (await request<{ results: Place[] }>(fetcher, `/api/geocode?${params}`)).results;
}

/** Lieu le plus proche d'un point (clic droit sur la carte), ou null. */
export async function reversePlace(
  point: { lat: number; lng: number },
  fetcher: Fetcher = fetch,
): Promise<Place | null> {
  const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
  return (await request<{ result: Place | null }>(fetcher, `/api/geocode/reverse?${params}`))
    .result;
}

/** Vue de la carte : zone visible et zoom. */
export interface MapView {
  bbox: Bbox;
  zoom: number;
}

/** Lieux des catégories dans la zone visible (découverte). */
export async function explorePois(
  view: MapView,
  categories: readonly PoiCategory[],
  fetcher: Fetcher = fetch,
): Promise<Poi[]> {
  const { west, south, east, north } = view.bbox;
  const params = new URLSearchParams({
    bbox: [west, south, east, north].join(','),
    zoom: String(view.zoom),
    categories: categories.join(','),
  });
  return (await request<{ pois: Poi[] }>(fetcher, `/api/poi?${params}`)).pois;
}

/** Résumé Wikipédia d'un lieu (référence « Q123 » ou « langue:titre »), ou null. */
export async function poiWiki(ref: string, fetcher: Fetcher = fetch): Promise<WikiSummary | null> {
  const params = new URLSearchParams({ ref });
  return (await request<{ summary: WikiSummary | null }>(fetcher, `/api/poi/wiki?${params}`))
    .summary;
}

/** Photos de couverture proposées par Wikimedia Commons pour ces mots-clés. */
export async function searchCovers(query: string, fetcher: Fetcher = fetch): Promise<TripCover[]> {
  const params = new URLSearchParams({ q: query });
  return (await request<{ covers: TripCover[] }>(fetcher, `/api/covers?${params}`)).covers;
}

/** Crée (ou remplace) le trajet d'une paire d'étapes consécutives. */
export function createLeg(
  tripId: string,
  version: number,
  leg: z.input<typeof LegCreate>,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/legs`, versioned(version, 'POST', leg));
}

export function updateLeg(
  tripId: string,
  legId: string,
  version: number,
  patch: LegPatch,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/legs/${legId}`, versioned(version, 'PATCH', patch));
}

export function deleteLeg(
  tripId: string,
  legId: string,
  version: number,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/legs/${legId}`, versioned(version, 'DELETE'));
}

/** Lot atomique de modifications d'étapes et de jours, en une seule version du voyage. */
export function applyBatch(
  tripId: string,
  version: number,
  ops: BatchOp[],
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/batch`, versioned(version, 'POST', { ops }));
}

/** Tracé GPX d'une randonnée (analysé dans le navigateur) : points, statistiques et durée. */
export function putGpx(
  tripId: string,
  stepId: string,
  version: number,
  gpx: GpxData,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(
    fetcher,
    `/api/trips/${tripId}/steps/${stepId}/gpx`,
    versioned(version, 'PUT', { gpx }),
  );
}

export function deleteGpx(
  tripId: string,
  stepId: string,
  version: number,
  fetcher: Fetcher = fetch,
): Promise<TripSnapshot> {
  return request(fetcher, `/api/trips/${tripId}/steps/${stepId}/gpx`, versioned(version, 'DELETE'));
}
