import { toDayNumber } from '@mytrips/core';

const monthLong = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const tabFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const dayTitleFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

function parts(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return { day: d.getUTCDate(), month: monthLong.format(d), year: d.getUTCFullYear() };
}

/** « 10 – 12 juillet 2026 », « 30 juin – 2 juillet 2026 », « 30 décembre 2026 – 2 janvier 2027 ». */
export function formatPeriod(startDate: string, endDate: string): string {
  const s = parts(startDate);
  const e = parts(endDate);
  if (startDate === endDate) return `${s.day} ${s.month} ${s.year}`;
  if (s.year !== e.year) return `${s.day} ${s.month} ${s.year} – ${e.day} ${e.month} ${e.year}`;
  if (s.month !== e.month) return `${s.day} ${s.month} – ${e.day} ${e.month} ${e.year}`;
  return `${s.day} – ${e.day} ${e.month} ${e.year}`;
}

/** Compte à rebours affiché sur la carte d'un voyage. */
export function countdownLabel(startDate: string, endDate: string, today: string): string {
  const untilStart = toDayNumber(startDate) - toDayNumber(today);
  if (untilStart > 1) return `Dans ${untilStart} jours`;
  if (untilStart === 1) return 'Demain';
  if (toDayNumber(endDate) >= toDayNumber(today)) return 'En cours';
  return 'Terminé';
}

/** « ven. 10 juil. » (onglet d'un jour). */
export function dayTabLabel(date: string): string {
  return tabFormat.format(new Date(`${date}T00:00:00Z`));
}

/** « Vendredi 10 juillet » (titre d'un jour). */
export function dayTitle(date: string): string {
  const label = dayTitleFormat.format(new Date(`${date}T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Date du jour (fuseau du navigateur) au format AAAA-MM-JJ. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** « 1 jour », « 3 jours ». */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}
