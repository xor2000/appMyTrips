import { legPairKey } from '../leg/required';
import type { Step } from '../step/schemas';
import { dayTimeline } from '../step/timeline';
import type { BatchOp } from './batch';
import { scheduleDay, type DaySchedule, type DayScheduleInput } from './schedule';

/** Jour à réorganiser, avec ce qu'il faut pour déplacer une étape ailleurs. */
export interface FixInput extends DayScheduleInput {
  dayId: string;
  /** Autres jours et leur temps libre, pour y déplacer une étape. */
  otherDays: { dayId: string; label: string; freeMin: number }[];
  /** Lendemain, pour y reporter la dernière étape d'un jour qui déborde. */
  nextDay: { dayId: string; label: string } | null;
}

export type FixRule = 'shorten' | 'advance-start' | 'move' | 'swap' | 'extend-end' | 'postpone';

/** Proposition de réorganisation, déjà simulée. */
export interface Fix {
  id: string;
  rule: FixRule;
  /** Changement proposé, ex. « Raccourcir : MuCEM 2 h → 1 h 40 ». */
  label: string;
  /** Effet simulé, ex. « conflit −20 min ». */
  effect: string;
  ops: BatchOp[];
  /** Minutes de retard et de dépassement en moins. */
  gain: number;
}

/** Durée minimale d'une étape raccourcie : 50 % de sa durée, et jamais moins de 15 min. */
const floorDuration = (d: number) => Math.max(15, Math.ceil(d / 2));
/** Avance maximale du début de journée. */
const MAX_ADVANCE_MIN = 120;
const MAX_FIXES = 4;

/** « 45 min », « 2 h », « 1 h 40 ». */
function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};
const toHhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;

/** Gravité d'un jour : minutes de retard sur les ancres + minutes de dépassement. */
export function badness(schedule: DaySchedule): number {
  return schedule.summary.lateMin + schedule.summary.overrunMin;
}

/** Applique des opérations de lot à un jour (simulation, sans effet de bord). */
export function applyOps<T extends DayScheduleInput>(day: T, ops: readonly BatchOp[]): T {
  let steps = day.steps.map((s) => ({ ...s }));
  let dayStart = day.dayStart;
  let dayEnd = day.dayEnd;
  const dayId = 'dayId' in day ? (day as unknown as FixInput).dayId : undefined;
  for (const op of ops) {
    if (op.kind === 'day') {
      if (op.patch.dayStart !== undefined) dayStart = op.patch.dayStart ?? dayStart;
      if (op.patch.dayEnd !== undefined) dayEnd = op.patch.dayEnd ?? dayEnd;
      continue;
    }
    const target = steps.find((s) => s.id === op.id);
    if (!target) continue;
    if (op.patch.dayId !== undefined && op.patch.dayId !== (dayId ?? target.dayId)) {
      // Étape (ou dossier, avec ses étapes) déplacée hors du jour.
      steps = steps.filter((s) => s.id !== op.id && s.parentId !== op.id);
      continue;
    }
    if (op.patch.durationMin !== undefined) target.durationMin = op.patch.durationMin;
    if (op.patch.position !== undefined) target.position = op.patch.position;
    if (op.patch.fixedStart !== undefined) target.fixedStart = op.patch.fixedStart;
  }
  return { ...day, steps, dayStart, dayEnd };
}

/** Effet lisible du passage de `before` à `after`. */
function effect(before: DaySchedule, after: DaySchedule): string {
  const parts: string[] = [];
  const b = before.summary;
  const a = after.summary;
  if (b.lateMin > 0) {
    parts.push(a.conflictCount === 0 ? 'conflit résolu' : `conflit −${b.lateMin - a.lateMin} min`);
  }
  if (b.overrunMin > 0) {
    parts.push(
      a.overrunMin === 0
        ? 'plus de dépassement'
        : `dépassement −${b.overrunMin - a.overrunMin} min`,
    );
  }
  return parts.join(' · ');
}

/** Étapes du jour dans l'ordre de passage (dossiers aplatis). */
function orderedSteps(day: DayScheduleInput): Step[] {
  const out: Step[] = [];
  for (const item of dayTimeline(day.date, day.steps, [])) {
    if (item.kind === 'step') out.push(item.step);
    else if (item.kind === 'group') out.push(...item.children);
  }
  return out;
}

const isFlexible = (s: Step) => s.kind === 'step' && s.fixedStart === null;

/**
 * Propositions de réorganisation d'un jour. Règles simples, chacune simulée par le moteur :
 * raccourcir les étapes souples avant l'ancre en conflit, avancer le début du jour (2 h au plus),
 * déplacer une étape souple vers le jour le plus libre (ou les idées), permuter deux étapes souples
 * adjacentes si les trajets connus raccourcissent ; en cas de dépassement, retarder la fin du jour
 * ou reporter la dernière étape souple au lendemain. Seules celles qui améliorent la situation
 * sont gardées, triées par gain, 4 au plus.
 */
export function proposeFixes(day: FixInput): Fix[] {
  const before = scheduleDay(day);
  const base = badness(before);
  if (base === 0) return [];

  const candidates: Omit<Fix, 'effect' | 'gain' | 'id'>[] = [];
  const steps = orderedSteps(day);
  const byKey = new Map(before.items.map((i) => [i.key, i]));

  // Première ancre (étape à heure fixe) en conflit, et les étapes souples qui la précèdent.
  const anchorIndex = steps.findIndex((s) =>
    byKey.get(s.id)?.issues.some((i) => i.kind === 'conflict'),
  );
  if (anchorIndex >= 0) {
    const anchor = byKey.get(steps[anchorIndex]!.id)!;
    const late = anchor.issues.reduce((t, i) => t + (i.kind === 'conflict' ? i.lateMin : 0), 0);
    let previousAnchor = -1;
    for (let i = anchorIndex - 1; i >= 0; i--) {
      if (steps[i]!.fixedStart) {
        previousAnchor = i;
        break;
      }
    }
    const flexible = steps.slice(previousAnchor + 1, anchorIndex).filter(isFlexible);

    // 1. Raccourcir proportionnellement à la marge de chaque étape.
    const margins = flexible.map((s) => s.durationMin - floorDuration(s.durationMin));
    const total = margins.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const cut = Math.min(late, total);
      const changes = flexible
        .map((s, i) => ({
          s,
          reduce: Math.min(margins[i]!, Math.round((cut * margins[i]!) / total)),
        }))
        .filter((c) => c.reduce > 0);
      if (changes.length > 0) {
        candidates.push({
          rule: 'shorten',
          label: `Raccourcir : ${changes
            .map(
              (c) =>
                `${c.s.name} ${duration(c.s.durationMin)} → ${duration(c.s.durationMin - c.reduce)}`,
            )
            .join(', ')}`,
          ops: changes.map((c) => ({
            kind: 'step' as const,
            id: c.s.id,
            patch: { durationMin: c.s.durationMin - c.reduce },
          })),
        });
      }
    }

    // 2. Avancer le début du jour.
    const advance = Math.min(ceil5(late), MAX_ADVANCE_MIN, toMin(day.dayStart));
    if (advance > 0) {
      const start = toHhmm(toMin(day.dayStart) - advance);
      candidates.push({
        rule: 'advance-start',
        label: `Commencer la journée à ${start} (au lieu de ${day.dayStart})`,
        ops: [{ kind: 'day', id: day.dayId, patch: { dayStart: start } }],
      });
    }

    // 3. Déplacer une étape souple : la plus courte qui suffit, sinon la plus longue.
    if (flexible.length > 0) {
      const enough = flexible
        .filter((s) => s.durationMin >= late)
        .sort((a, b) => a.durationMin - b.durationMin);
      const chosen = enough[0] ?? [...flexible].sort((a, b) => b.durationMin - a.durationMin)[0]!;
      const target = [...day.otherDays].sort((a, b) => b.freeMin - a.freeMin)[0] ?? null;
      candidates.push({
        rule: 'move',
        label: `Déplacer ${chosen.name} ${target ? `vers ${target.label}` : 'vers les idées'}`,
        ops: [{ kind: 'step', id: chosen.id, patch: { dayId: target?.dayId ?? null } }],
      });
    }

    // 4. Permuter deux étapes souples adjacentes (même dossier) si les trajets connus raccourcissent.
    const legs = new Map(day.legs.map((l) => [legPairKey(l.fromKey, l.toKey), l.durationMin]));
    const travel = (keys: string[]) => {
      let t = 0;
      for (let i = 1; i < keys.length; i++) {
        const d = legs.get(legPairKey(keys[i - 1]!, keys[i]!));
        if (d === undefined) return null;
        t += d;
      }
      return t;
    };
    for (let i = previousAnchor + 1; i < anchorIndex - 1; i++) {
      const a = steps[i]!;
      const b = steps[i + 1]!;
      if (!isFlexible(a) || !isFlexible(b) || a.parentId !== b.parentId) continue;
      const prev = steps[i - 1]?.id;
      const next = steps[i + 2]?.id;
      const keys = (x: string, y: string) => [prev, x, y, next].filter((k): k is string => !!k);
      const current = travel(keys(a.id, b.id));
      const swapped = travel(keys(b.id, a.id));
      if (current === null || swapped === null || swapped >= current) continue;
      candidates.push({
        rule: 'swap',
        label: `Permuter ${a.name} et ${b.name}`,
        ops: [
          { kind: 'step', id: a.id, patch: { position: b.position } },
          { kind: 'step', id: b.id, patch: { position: a.position } },
        ],
      });
    }
  }

  // 5. Dépassement de la journée.
  const overrun = before.summary.overrunMin;
  if (overrun > 0) {
    const end = Math.min(toMin(day.dayEnd) + ceil5(overrun), 23 * 60 + 59);
    if (end > toMin(day.dayEnd)) {
      candidates.push({
        rule: 'extend-end',
        label: `Finir la journée à ${toHhmm(end)} (au lieu de ${day.dayEnd})`,
        ops: [{ kind: 'day', id: day.dayId, patch: { dayEnd: toHhmm(end) } }],
      });
    }
    const last = [...steps].reverse().find(isFlexible);
    if (last && day.nextDay) {
      candidates.push({
        rule: 'postpone',
        label: `Reporter ${last.name} à ${day.nextDay.label}`,
        ops: [{ kind: 'step', id: last.id, patch: { dayId: day.nextDay.dayId } }],
      });
    }
  }

  return candidates
    .map((c, i) => {
      const after = scheduleDay(applyOps(day, c.ops));
      return {
        ...c,
        id: `${c.rule}-${i}`,
        gain: base - badness(after),
        effect: effect(before, after),
      };
    })
    .filter((f) => f.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, MAX_FIXES);
}
