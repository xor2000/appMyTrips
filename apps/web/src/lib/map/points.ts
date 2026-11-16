import { STEP_TYPE_INFO, dayTimeline, type Day, type Stay, type Step } from '@mytrips/core';

/** Marqueur affiché sur la carte. */
export interface MapPoint {
  /** Clé de l'étape (ou de l'occurrence de séjour), partagée avec la timeline pour le survol. */
  key: string;
  /** Identifiant de l'étape à ouvrir au clic (null pour un séjour). */
  stepId: string | null;
  name: string;
  lat: number;
  lng: number;
  /** Texte du marqueur : numéro d'ordre, « H » pour un séjour, « J2 » en vue d'ensemble. */
  label: string;
  /** Variable CSS de la couleur du type. */
  color: string;
  faded: boolean;
}

function stepPoint(s: Step, label: string): MapPoint | null {
  if (s.lat === null || s.lng === null) return null;
  return {
    key: s.id,
    stepId: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    label,
    color: s.type ? STEP_TYPE_INFO[s.type].color : '--type-transport',
    faded: false,
  };
}

function stayPoint(stay: Stay, key: string): MapPoint {
  return {
    key,
    stepId: null,
    name: stay.name,
    lat: stay.lat,
    lng: stay.lng,
    label: 'H',
    color: '--type-hotel',
    faded: false,
  };
}

/**
 * Marqueurs de la carte. Pour un jour : étapes numérotées dans l'ordre de la timeline, séjours « H ».
 * Pour tout le voyage (selectedDay = null) : chaque étape porte son jour, chaque séjour une fois.
 */
export function mapPoints(
  data: { days: Day[]; steps: Step[]; stays: Stay[] },
  selectedDay: string | null,
): MapPoint[] {
  const points: MapPoint[] = [];
  if (selectedDay !== null) {
    const day = data.days.find((d) => d.id === selectedDay);
    if (!day) return points;
    const items = dayTimeline(
      day.date,
      data.steps.filter((s) => s.dayId === day.id),
      data.stays,
    );
    let n = 0;
    for (const item of items) {
      if (item.kind === 'stay') {
        points.push(stayPoint(item.stay, item.key));
        continue;
      }
      const steps = item.kind === 'step' ? [item.step] : item.children;
      for (const s of steps) {
        const p = stepPoint(s, String(n + 1));
        if (p) {
          n += 1;
          points.push(p);
        }
      }
    }
    return points;
  }

  data.days.forEach((day, i) => {
    const items = dayTimeline(
      day.date,
      data.steps.filter((s) => s.dayId === day.id),
      [],
    );
    for (const item of items) {
      const steps = item.kind === 'step' ? [item.step] : item.kind === 'group' ? item.children : [];
      for (const s of steps) {
        const p = stepPoint(s, `J${i + 1}`);
        if (p) points.push(p);
      }
    }
  });
  for (const stay of data.stays) points.push(stayPoint(stay, `stay:${stay.id}`));
  return points;
}
