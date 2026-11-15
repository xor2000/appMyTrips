const DAY_MS = 24 * 60 * 60 * 1000;

/** Date AAAA-MM-JJ → nombre de jours depuis l'époque (calcul en UTC, sans effet de l'heure d'été). */
export function toDayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Toutes les dates de la période, bornes incluses, dans l'ordre. */
export function datesInPeriod(startDate: string, endDate: string): string[] {
  const start = toDayNumber(startDate);
  const end = toDayNumber(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) throw new Error('Date invalide');
  if (end < start) throw new Error('La fin de la période précède son début');
  const dates: string[] = [];
  for (let n = start; n <= end; n++) dates.push(fromDayNumber(n));
  return dates;
}

/** Jours à créer et à supprimer pour passer des dates actuelles à la nouvelle période. */
export function diffPeriod(
  currentDates: readonly string[],
  startDate: string,
  endDate: string,
): { toAdd: string[]; toRemove: string[] } {
  const next = datesInPeriod(startDate, endDate);
  const current = new Set(currentDates);
  const wanted = new Set(next);
  return {
    toAdd: next.filter((d) => !current.has(d)),
    toRemove: [...currentDates].filter((d) => !wanted.has(d)).sort(),
  };
}
