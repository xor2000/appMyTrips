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

/** « 45 min », « 1 h », « 1 h 30 », « 2 h 05 ». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Heures d'une journée et sa durée : « 08:00 → 22:00 · 14 h » (fin après minuit : le lendemain). */
export function dayHoursLabel(start: string, end: string): string {
  const toMin = (t: string) => {
    const [h = 0, m = 0] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let minutes = toMin(end) - toMin(start);
  if (minutes <= 0) minutes += 24 * 60;
  return `${start} → ${end} · ${formatDuration(minutes)}`;
}

/** « 850 m », « 1,2 km », « 72 km ». */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}

/** Distance en kilomètres avec une décimale : « 12,4 km ». */
export function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
