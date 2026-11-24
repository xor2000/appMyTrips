import { DateTime } from 'luxon';
import type { Leg } from '../leg/schemas';
import { legPairKey } from '../leg/required';
import type { Stay, Step } from '../step/schemas';
import { dayTimeline } from '../step/timeline';

/** Données d'un jour pour le moteur d'horaires (heures du jour déjà résolues). */
export interface DayScheduleInput {
  date: string;
  /** Étapes et dossiers du jour. */
  steps: Step[];
  stays: Stay[];
  legs: Leg[];
  dayStart: string;
  dayEnd: string;
  /** Fuseau par défaut (voyage), pour les points sans fuseau. */
  timezone: string;
}

/** Heure locale « HH:mm », et décalage en jours par rapport à la date du jour (« +1 j »). */
export interface LocalTime {
  time: string;
  dayOffset: number;
}

export type ScheduleIssue = { kind: 'conflict'; lateMin: number };

export interface ScheduledItem {
  key: string;
  kind: 'step' | 'stay' | 'group';
  start: LocalTime;
  end: LocalTime;
  timezone: string;
  /** Attente avant une heure fixe atteinte en avance. */
  freeBeforeMin: number;
  issues: ScheduleIssue[];
}

export interface ScheduledLeg {
  key: string;
  fromKey: string;
  toKey: string;
  depart: LocalTime;
  arrive: LocalTime;
  durationMin: number;
  missing: boolean;
  /** Attente avant un départ à heure fixe. */
  freeBeforeMin: number;
  issues: ScheduleIssue[];
}

export interface DaySummary {
  onSiteMin: number;
  travelMin: number;
  freeMin: number;
  overrunMin: number;
  conflictCount: number;
  lateMin: number;
}

export interface DaySchedule {
  items: ScheduledItem[];
  legs: ScheduledLeg[];
  summary: DaySummary;
}

/** Heures du jour : celles du jour si surchargées, sinon celles du voyage. */
export function resolveDayBounds(
  day: { dayStart: string | null; dayEnd: string | null },
  trip: { dayStart: string; dayEnd: string },
) {
  return { dayStart: day.dayStart ?? trip.dayStart, dayEnd: day.dayEnd ?? trip.dayEnd };
}

/** Fuseau valide, sinon UTC. */
function zone(tz: string | null | undefined, fallback: string): string {
  for (const candidate of [tz, fallback]) {
    if (candidate && DateTime.now().setZone(candidate).isValid) return candidate;
  }
  return 'UTC';
}

/** Instant d'une heure locale du jour `date` dans le fuseau `tz`. */
function at(date: string, time: string, tz: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone: tz });
}

function local(instant: DateTime, date: string, tz: string): LocalTime {
  const t = instant.setZone(tz);
  const day = DateTime.fromISO(date, { zone: tz }).startOf('day');
  return {
    time: t.toFormat('HH:mm'),
    dayOffset: Math.round(t.startOf('day').diff(day, 'days').days),
  };
}

const minutesBetween = (a: DateTime, b: DateTime) => Math.round(b.diff(a, 'minutes').minutes);

/** Point de passage aplati : étape, ou occurrence de séjour. */
interface Slot {
  key: string;
  kind: 'step' | 'stay';
  durationMin: number;
  fixedStart: string | null;
  timezone: string | null;
  parentId: string | null;
}

/**
 * Horaires d'un jour. Départ au début du jour, puis on enchaîne : arrivée, fin de l'étape
 * (arrivée + durée), trajet, et ainsi de suite.
 * - Une heure fixe est une ancre : arrivée en avance = temps libre ; en retard = conflit (retard en
 *   minutes) ; l'étape commence à son heure fixe dans les deux cas. Même règle pour le départ fixé
 *   d'un trajet.
 * - L'arrivée d'un trajet s'exprime dans le fuseau de l'étape d'arrivée (« +1 j » après minuit).
 * - Les trajets sont facultatifs : sans trajet, l'enchaînement compte 0 min, sans signalement.
 * - Dépassement : fin de la dernière activité (ou arrivée au séjour du soir) après la fin du jour.
 */
export function scheduleDay(input: DayScheduleInput): DaySchedule {
  const items = dayTimeline(input.date, input.steps, input.stays);
  const slots: Slot[] = [];
  for (const item of items) {
    if (item.kind === 'stay') {
      slots.push({
        key: item.key,
        kind: 'stay',
        durationMin: 0,
        fixedStart: null,
        timezone: null,
        parentId: null,
      });
      continue;
    }
    const steps = item.kind === 'step' ? [item.step] : item.children;
    for (const s of steps) {
      slots.push({
        key: s.id,
        kind: 'step',
        durationMin: s.durationMin,
        fixedStart: s.fixedStart,
        timezone: s.timezone,
        parentId: s.parentId,
      });
    }
  }

  const summary: DaySummary = {
    onSiteMin: 0,
    travelMin: 0,
    freeMin: 0,
    overrunMin: 0,
    conflictCount: 0,
    lateMin: 0,
  };
  if (slots.length === 0) return { items: [], legs: [], summary };

  // Fuseau de chaque point : le sien, sinon celui du point voisin (séjours), sinon le voyage.
  const zones: string[] = slots.map((s) => (s.timezone ? zone(s.timezone, input.timezone) : ''));
  for (let i = 0; i < zones.length; i++) {
    if (!zones[i]) {
      const neighbour =
        zones.slice(i + 1).find(Boolean) ?? zones.slice(0, i).reverse().find(Boolean);
      zones[i] = neighbour || zone(input.timezone, 'UTC');
    }
  }

  const legsByPair = new Map(input.legs.map((l) => [legPairKey(l.fromKey, l.toKey), l]));
  const scheduled: ScheduledItem[] = [];
  const scheduledLegs: ScheduledLeg[] = [];
  let cursor = at(input.date, input.dayStart, zones[0]!);

  slots.forEach((slot, i) => {
    const tz = zones[i]!;
    let arrival = cursor;
    if (i > 0) {
      const from = slots[i - 1]!;
      const fromTz = zones[i - 1]!;
      const leg = legsByPair.get(legPairKey(from.key, slot.key));
      const issues: ScheduleIssue[] = [];
      let depart = cursor;
      let freeBeforeMin = 0;
      if (leg?.departAt) {
        const anchor = at(input.date, leg.departAt, fromTz);
        const gap = minutesBetween(cursor, anchor);
        if (gap >= 0) freeBeforeMin = gap;
        else issues.push({ kind: 'conflict', lateMin: -gap });
        depart = anchor;
      }
      const durationMin = leg?.durationMin ?? 0;
      arrival = depart.plus({ minutes: durationMin });
      scheduledLegs.push({
        key: legPairKey(from.key, slot.key),
        fromKey: from.key,
        toKey: slot.key,
        depart: local(depart, input.date, fromTz),
        arrive: local(arrival, input.date, tz),
        durationMin,
        missing: !leg,
        freeBeforeMin,
        issues,
      });
      summary.travelMin += durationMin;
      summary.freeMin += freeBeforeMin;
      for (const issue of issues) {
        if (issue.kind === 'conflict') {
          summary.conflictCount += 1;
          summary.lateMin += issue.lateMin;
        }
      }
    }

    const issues: ScheduleIssue[] = [];
    let start = arrival;
    let freeBeforeMin = 0;
    if (slot.fixedStart) {
      const anchor = at(input.date, slot.fixedStart, tz);
      const gap = minutesBetween(arrival, anchor);
      if (gap >= 0) freeBeforeMin = gap;
      else {
        issues.push({ kind: 'conflict', lateMin: -gap });
        summary.conflictCount += 1;
        summary.lateMin += -gap;
      }
      start = anchor;
    }
    const end = start.plus({ minutes: slot.durationMin });
    summary.onSiteMin += slot.durationMin;
    summary.freeMin += freeBeforeMin;
    scheduled.push({
      key: slot.key,
      kind: slot.kind,
      start: local(start, input.date, tz),
      end: local(end, input.date, tz),
      timezone: tz,
      freeBeforeMin,
      issues,
    });
    cursor = end;
  });

  const lastTz = zones[zones.length - 1]!;
  summary.overrunMin = Math.max(0, minutesBetween(at(input.date, input.dayEnd, lastTz), cursor));

  // Dossiers : du début de leur premier enfant à la fin du dernier.
  for (const item of items) {
    if (item.kind !== 'group' || item.children.length === 0) continue;
    const first = scheduled.find((s) => s.key === item.children[0]!.id);
    const last = scheduled.find((s) => s.key === item.children[item.children.length - 1]!.id);
    if (!first || !last) continue;
    scheduled.push({
      key: item.key,
      kind: 'group',
      start: first.start,
      end: last.end,
      timezone: first.timezone,
      freeBeforeMin: 0,
      issues: [],
    });
  }

  return { items: scheduled, legs: scheduledLegs, summary };
}

/** Recherche d'un élément planifié par clé. */
export function scheduledItem(schedule: DaySchedule, key: string): ScheduledItem | undefined {
  return schedule.items.find((i) => i.key === key);
}
