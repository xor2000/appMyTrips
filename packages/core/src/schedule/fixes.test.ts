import { describe, expect, it } from 'vitest';
import type { Leg } from '../leg/schemas';
import type { Step } from '../step/schemas';
import { applyOps, badness, proposeFixes, type FixInput } from './fixes';
import { scheduleDay } from './schedule';

let n = 0;
function step(id: string, durationMin: number, extra: Partial<Step> = {}): Step {
  n += 1;
  return {
    id,
    dayId: 'd1',
    parentId: null,
    position: `a${String(n).padStart(3, '0')}`,
    kind: 'step',
    type: 'museum',
    name: id,
    lat: 45,
    lng: 6,
    address: null,
    exitLat: null,
    exitLng: null,
    durationMin,
    fixedStart: null,
    timezone: 'Europe/Paris',
    openingHours: null,
    osmRef: null,
    bookingRef: null,
    bookingUrl: null,
    notes: '',
    gpx: null,
    useElevation: false,
    durationManual: false,
    ...extra,
  };
}

function leg(fromKey: string, toKey: string, durationMin: number): Leg {
  return {
    id: `${fromKey}-${toKey}`,
    fromKey,
    toKey,
    mode: 'car',
    distanceM: 1000,
    durationMin,
    distanceSource: 'router',
    durationSource: 'router',
    geometry: null,
    summary: null,
    departAt: null,
    bookingRef: null,
    color: null,
    notes: '',
    computedAt: null,
  };
}

function fixInput(steps: Step[], legs: Leg[], extra: Partial<FixInput> = {}): FixInput {
  return {
    dayId: 'd1',
    date: '2026-07-10',
    steps,
    stays: [],
    legs,
    dayStart: '08:00',
    dayEnd: '22:00',
    timezone: 'Europe/Paris',
    otherDays: [],
    nextDay: null,
    ...extra,
  };
}

/** Conflit de 20 min : MuCEM (2 h) puis vol à 10:00 (trajet de 0 min, mêmes lieux). */
function conflictDay(extra: Partial<FixInput> = {}) {
  return fixInput(
    [
      step('mucem', 120, { name: 'MuCEM' }),
      step('vol', 60, { name: 'Vol', type: 'airport', fixedStart: '10:00' }),
    ],
    [leg('mucem', 'vol', 20)],
    extra,
  );
}

const rules = (fixes: ReturnType<typeof proposeFixes>) => fixes.map((f) => f.rule);

describe('proposeFixes', () => {
  it('aucune proposition quand il n’y a ni conflit ni dépassement', () => {
    const day = fixInput([step('a', 60), step('b', 60)], [leg('a', 'b', 10)]);
    expect(proposeFixes(day)).toEqual([]);
  });

  it('raccourcir les étapes souples avant l’ancre (MuCEM 2 h → 1 h 40)', () => {
    const fixes = proposeFixes(conflictDay());
    const shorten = fixes.find((f) => f.rule === 'shorten')!;
    expect(shorten.label).toBe('Raccourcir : MuCEM 2 h → 1 h 40');
    expect(shorten.effect).toBe('conflit résolu');
    expect(shorten.ops).toEqual([{ kind: 'step', id: 'mucem', patch: { durationMin: 100 } }]);
  });

  it('raccourcir : jamais sous 50 % de la durée ni sous 15 min', () => {
    // Retard de 100 min, mais MuCEM ne peut perdre que 60 min (120 → 60).
    const day = fixInput(
      [step('mucem', 120, { name: 'MuCEM' }), step('vol', 60, { fixedStart: '09:00' })],
      [leg('mucem', 'vol', 40)],
    );
    const shorten = proposeFixes(day).find((f) => f.rule === 'shorten')!;
    expect(shorten.ops).toEqual([{ kind: 'step', id: 'mucem', patch: { durationMin: 60 } }]);
    expect(shorten.effect).toBe('conflit −60 min');
    // 15 min : déjà au plancher, rien à raccourcir.
    const tiny = fixInput(
      [step('cafe', 15), step('vol', 60, { fixedStart: '08:10' })],
      [leg('cafe', 'vol', 0)],
    );
    expect(rules(proposeFixes(tiny))).not.toContain('shorten');
  });

  it('avancer le début du jour, de 2 h au plus', () => {
    const fixes = proposeFixes(conflictDay());
    const advance = fixes.find((f) => f.rule === 'advance-start')!;
    expect(advance.ops).toEqual([{ kind: 'day', id: 'd1', patch: { dayStart: '07:40' } }]);
    expect(advance.label).toBe('Commencer la journée à 07:40 (au lieu de 08:00)');
    const late = fixInput(
      [step('a', 400), step('vol', 60, { fixedStart: '10:00' })],
      [leg('a', 'vol', 0)],
    );
    const capped = proposeFixes(late).find((f) => f.rule === 'advance-start')!;
    expect(capped.ops).toEqual([{ kind: 'day', id: 'd1', patch: { dayStart: '06:00' } }]);
  });

  it('déplacer une étape souple vers le jour le plus libre, sinon vers les idées', () => {
    const toDay = proposeFixes(
      conflictDay({
        otherDays: [
          { dayId: 'd2', label: 'J2', freeMin: 120 },
          { dayId: 'd3', label: 'J3', freeMin: 400 },
        ],
      }),
    ).find((f) => f.rule === 'move')!;
    expect(toDay.label).toBe('Déplacer MuCEM vers J3');
    expect(toDay.ops).toEqual([{ kind: 'step', id: 'mucem', patch: { dayId: 'd3' } }]);
    const toIdeas = proposeFixes(conflictDay()).find((f) => f.rule === 'move')!;
    expect(toIdeas.label).toBe('Déplacer MuCEM vers les idées');
    expect(toIdeas.ops).toEqual([{ kind: 'step', id: 'mucem', patch: { dayId: null } }]);
  });

  it('permuter deux étapes souples adjacentes si les trajets connus raccourcissent', () => {
    // Ordre a, b, c (c à heure fixe) : a→b 60, b→c 60. Ordre b, a, c : b→a 10, a→c 10.
    const a = step('a', 60);
    const b = step('b', 60);
    const c = step('c', 60, { fixedStart: '10:30' });
    const day = fixInput(
      [a, b, c],
      [leg('a', 'b', 60), leg('b', 'c', 60), leg('b', 'a', 10), leg('a', 'c', 10)],
    );
    const swap = proposeFixes(day).find((f) => f.rule === 'swap')!;
    expect(swap.label).toBe('Permuter a et b');
    expect(swap.ops).toEqual([
      { kind: 'step', id: 'a', patch: { position: b.position } },
      { kind: 'step', id: 'b', patch: { position: a.position } },
    ]);
    // Trajets inconnus pour le nouvel ordre : pas de proposition.
    const unknown = fixInput(
      [step('x', 60), step('y', 60), step('z', 60, { fixedStart: '10:30' })],
      [leg('x', 'y', 60), leg('y', 'z', 60)],
    );
    expect(rules(proposeFixes(unknown))).not.toContain('swap');
  });

  it('dépassement : retarder la fin du jour, ou reporter la dernière étape souple au lendemain', () => {
    const day = fixInput(
      [step('a', 600), step('b', 300, { name: 'Calanques' })],
      [leg('a', 'b', 54)],
      { nextDay: { dayId: 'd2', label: 'J2' } },
    );
    const fixes = proposeFixes(day);
    const extend = fixes.find((f) => f.rule === 'extend-end')!;
    expect(extend.ops).toEqual([{ kind: 'day', id: 'd1', patch: { dayEnd: '23:55' } }]);
    expect(extend.effect).toBe('plus de dépassement');
    const postpone = fixes.find((f) => f.rule === 'postpone')!;
    expect(postpone.label).toBe('Reporter Calanques à J2');
    expect(postpone.ops).toEqual([{ kind: 'step', id: 'b', patch: { dayId: 'd2' } }]);
  });

  it('chaque proposition améliore la situation simulée ; triées par gain, 4 au plus', () => {
    const day = conflictDay({ otherDays: [{ dayId: 'd2', label: 'J2', freeMin: 300 }] });
    const before = badness(scheduleDay(day));
    const fixes = proposeFixes(day);
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes.length).toBeLessThanOrEqual(4);
    for (const f of fixes) {
      const after = badness(scheduleDay(applyOps(day, f.ops)));
      expect(after, f.rule).toBeLessThan(before);
      expect(f.gain).toBe(before - after);
    }
    const gains = fixes.map((f) => f.gain);
    expect(gains).toEqual([...gains].sort((x, y) => y - x));
  });
});

describe('applyOps', () => {
  it('applique durées, changements de jour (dossier compris) et heures du jour', () => {
    const g = step('g', 0, { kind: 'group', type: null, lat: null, lng: null });
    const child = step('g1', 30, { parentId: 'g' });
    const day = fixInput([step('a', 60), g, child], []);
    const next = applyOps(day, [
      { kind: 'step', id: 'a', patch: { durationMin: 45 } },
      { kind: 'step', id: 'g', patch: { dayId: 'd2' } },
      { kind: 'day', id: 'd1', patch: { dayStart: '07:00' } },
    ]);
    expect(next.steps.map((s) => [s.id, s.durationMin])).toEqual([['a', 45]]);
    expect(next.dayStart).toBe('07:00');
  });
});
