import type {
  DayPatch,
  Role,
  TripCreate,
  TripPatch,
  TripSnapshot,
  TripSummary,
} from '@mytrips/core';

type Fetcher = typeof fetch;

const MESSAGES: Record<string, string> = {
  version_conflict: 'Le voyage a été modifié entre-temps : il vient d’être rechargé.',
  version_required: 'La version du voyage manque : rechargez la page.',
  days_not_empty: 'Des jours à supprimer contiennent des informations.',
  forbidden: 'Vous n’avez pas le droit de faire cette modification.',
  not_found: 'Voyage introuvable.',
  invalid: 'Certaines informations sont invalides.',
  invalid_email: 'Adresse e-mail invalide.',
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
