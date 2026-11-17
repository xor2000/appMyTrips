import { coverQuery, type TripCover, type TripSummary } from '@mytrips/core';

/** Voyages déjà cherchés sans succès sur cet appareil (identifiants, JSON). */
export const COVER_TRIED_KEY = 'mytrips.coverTried';

type CoverStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): CoverStorage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Identifiants des voyages pour lesquels aucune photo n'a été trouvée sur cet appareil. */
export function readTriedCovers(storage: CoverStorage | null = defaultStorage()): Set<string> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(COVER_TRIED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function markTried(storage: CoverStorage | null, id: string) {
  const tried = readTriedCovers(storage);
  tried.add(id);
  try {
    storage?.setItem(COVER_TRIED_KEY, JSON.stringify([...tried]));
  } catch {
    // Stockage indisponible : la recherche sera retentée à la prochaine visite.
  }
}

interface AutoCoverDeps {
  search: (query: string) => Promise<TripCover[]>;
  save: (trip: TripSummary, cover: TripCover) => Promise<void>;
  storage?: CoverStorage | null;
}

/**
 * Donne une photo aux voyages qui n'en ont pas et que l'utilisateur peut modifier : la première
 * trouvée pour les mots-clés du voyage. Sans mot-clé ni résultat, le voyage n'est plus cherché sur
 * cet appareil ; une erreur réseau ne marque rien (nouvel essai à la prochaine visite).
 * Les voyages sont traités l'un après l'autre (pas de rafale vers Commons).
 */
export async function autoCovers(
  trips: TripSummary[],
  { search, save, storage = defaultStorage() }: AutoCoverDeps,
) {
  const tried = readTriedCovers(storage);
  const todo = trips.filter((t) => !t.cover && t.role !== 'viewer' && !tried.has(t.id));
  for (const trip of todo) {
    const query = coverQuery(trip.name, trip.places);
    if (!query) {
      markTried(storage, trip.id);
      continue;
    }
    try {
      const [first] = await search(query);
      if (first) await save(trip, first);
      else markTried(storage, trip.id);
    } catch {
      // Réseau ou conflit de version : on réessaiera plus tard.
    }
  }
}
