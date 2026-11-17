import {
  dayTimeline,
  type Day,
  type Leg,
  type ScheduledItem,
  type Stay,
  type Step,
  type TimelineItem,
} from '@mytrips/core';
import { dayPairs, type DayPair } from '#lib/legs/legs.ts';
import { mapPoints } from '#lib/map/points.ts';

/**
 * Tout ce qu'il faut pour dessiner un jour, quel que soit l'affichage (liste, ligne de métro,
 * colonnes du plein écran) : les trois affichages partagent ces calculs.
 */
export interface DayView {
  day: Day;
  /** Rang du jour (0 = J1). */
  index: number;
  items: TimelineItem[];
  /** Paires d'étapes consécutives (trajets requis), indexées par leur départ. */
  pairs: Map<string, DayPair>;
  /** Horaires calculés, par clé d'étape. */
  times: Map<string, ScheduledItem>;
  /** Numéros de carte, par clé d'étape (idées exclues). */
  labels: Map<string, string>;
}

export function buildDayViews(
  data: { days: Day[]; steps: Step[]; stays: Stay[]; legs: Leg[] },
  schedules: Map<string, { items: ScheduledItem[] }>,
): DayView[] {
  return data.days.map((day, index) => {
    const items = dayTimeline(
      day.date,
      data.steps.filter((s) => s.dayId === day.id),
      data.stays,
    );
    const labels = new Map(
      mapPoints(data, day.id)
        .filter((p) => !p.idea)
        .map((p) => [p.key, p.label]),
    );
    return {
      day,
      index,
      items,
      pairs: dayPairs(items, data.legs),
      times: new Map((schedules.get(day.id)?.items ?? []).map((i) => [i.key, i])),
      labels,
    };
  });
}
