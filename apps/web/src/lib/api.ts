import type {
  DayPatch,
  Place,
  Role,
  StayCreate,
  StayPatch,
  StepCreate,
  StepPatch,
  TripCreate,
  TripPatch,
  TripSnapshot,
  TripSummary,
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
  owner_cannot_be_member: 'Le propriétaire a déjà tous les droits sur ce voyage.',
  unauthorized: 'Session expirée : rechargez la page pour vous reconnecter.',
};

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
    throw new ApiError(res.status, code, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Utilisateur connecté (identité Cloudflare Access), ou null si l'API ne répond pas. */
export async function fetchMe(fetcher: Fetcher = fetch): Promise<{ email: string } | null> {
  try {
    const body = await request<unknown>(fetcher, '/api/me');
    if (body && typeof body === 'object' && 'email' in body && typeof body.email === 'string') {
      return { email: body.email };
    }
    return null;
  } catch {
    return null;
  }
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
