import { describe, expect, it } from 'vitest';
import type { Stay, Step } from './schemas';
import { dayRoute, dayTimeline, isDayEmpty } from './timeline';

let n = 0;
function step(overrides: Partial<Step> = {}): Step {
  n += 1;
  return {
    id: `s${n}`,
    dayId: 'd1',
    parentId: null,
    position: `a${n}`,
    kind: 'step',
    type: 'museum',
    name: `Étape ${n}`,
    lat: 45 + n / 100,
    lng: 6 + n / 100,
    address: null,
    exitLat: null,
    exitLng: null,
    durationMin: 60,
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
    icon: null,
    color: null,
    ...overrides,
  };
}

function stay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: 'h1',
    name: 'Chalet de Cotagne',
    lat: 45.9,
    lng: 6.3,
    address: null,
    checkInDate: '2026-07-10',
    checkInTime: '17:00',
    checkOutDate: '2026-07-12',
    checkOutTime: '10:00',
    bookingRef: null,
    notes: '',
    ...overrides,
  };
}

describe('dayTimeline', () => {
  it('renvoie une timeline vide pour un jour sans étape ni séjour', () => {
    expect(dayTimeline('2026-07-10', [], [])).toEqual([]);
  });

  it('trie les étapes du jour par position', () => {
    const a = step({ position: 'a2', name: 'B' });
    const b = step({ position: 'a1', name: 'A' });
    const items = dayTimeline('2026-07-10', [a, b], []);
    expect(items.map((i) => (i.kind === 'step' ? i.step.name : i.kind))).toEqual(['A', 'B']);
  });

  it('place un séjour d’une nuit en fin du premier jour (check-in) et au début du lendemain (check-out)', () => {
    const h = stay({ checkInDate: '2026-07-10', checkOutDate: '2026-07-11' });
    const day1 = dayTimeline('2026-07-10', [step()], [h]);
    expect(day1.at(-1)).toMatchObject({ kind: 'stay', edge: 'end', label: 'check-in' });
    expect(day1[0]?.kind).toBe('step');

    const day2 = dayTimeline('2026-07-11', [], [h]);
    expect(day2).toHaveLength(1);
    expect(day2[0]).toMatchObject({
      kind: 'stay',
      edge: 'start',
      label: 'check-out',
      key: 'stay:h1:2026-07-11:start',
    });
  });

  it('un séjour de 3 nuits encadre le jour du milieu (départ le matin, retour le soir)', () => {
    const h = stay({ checkInDate: '2026-07-10', checkOutDate: '2026-07-13' });
    const middle = dayTimeline('2026-07-11', [step()], [h]);
    expect(middle[0]).toMatchObject({ kind: 'stay', edge: 'start', label: 'départ' });
    expect(middle.at(-1)).toMatchObject({ kind: 'stay', edge: 'end', label: 'retour' });
  });

  it('enchaîne deux séjours le même jour : check-out du premier, check-in du second', () => {
    const a = stay({ id: 'h1', checkInDate: '2026-07-09', checkOutDate: '2026-07-10' });
    const b = stay({ id: 'h2', checkInDate: '2026-07-10', checkOutDate: '2026-07-12' });
    const items = dayTimeline('2026-07-10', [], [a, b]);
    expect(items.map((i) => i.kind === 'stay' && `${i.stay.id}:${i.edge}`)).toEqual([
      'h1:start',
      'h2:end',
    ]);
  });

  it('ignore un séjour qui ne couvre pas le jour', () => {
    const h = stay({ checkInDate: '2026-07-20', checkOutDate: '2026-07-22' });
    expect(dayTimeline('2026-07-10', [], [h])).toEqual([]);
  });

  it('regroupe les enfants d’un dossier sous lui, triés par position', () => {
    const g = step({ kind: 'group', type: null, name: 'Vieux-Port', lat: null, lng: null });
    const c2 = step({ parentId: g.id, position: 'a2', name: 'Restaurant' });
    const c1 = step({ parentId: g.id, position: 'a1', name: 'Notre-Dame' });
    const items = dayTimeline('2026-07-10', [c2, g, c1], []);
    expect(items).toHaveLength(1);
    const group = items[0];
    expect(group?.kind).toBe('group');
    if (group?.kind === 'group') {
      expect(group.children.map((c) => c.name)).toEqual(['Notre-Dame', 'Restaurant']);
    }
  });

  it('affiche un dossier vide', () => {
    const g = step({ kind: 'group', type: null, lat: null, lng: null });
    const items = dayTimeline('2026-07-10', [g], []);
    expect(items[0]).toMatchObject({ kind: 'group', children: [] });
  });
});

describe('dayRoute', () => {
  it('aplatit le jour en points : séjour du matin, étapes, enfants de dossier, séjour du soir', () => {
    const h = stay({ checkInDate: '2026-07-09', checkOutDate: '2026-07-12' });
    const a = step({ position: 'a1', name: 'MuCEM' });
    const g = step({ position: 'a2', kind: 'group', type: null, lat: null, lng: null });
    const c1 = step({ parentId: g.id, position: 'a1', name: 'Notre-Dame' });
    const c2 = step({ parentId: g.id, position: 'a2', name: 'Restaurant' });
    const route = dayRoute(dayTimeline('2026-07-10', [a, g, c1, c2], [h]));
    expect(route.map((p) => p.label)).toEqual([
      'Chalet de Cotagne',
      'MuCEM',
      'Notre-Dame',
      'Restaurant',
      'Chalet de Cotagne',
    ]);
    expect(route[0]?.key).toBe('stay:h1:2026-07-10:start');
  });

  it('utilise le point de sortie d’une étape quand il diffère de l’entrée (randonnée)', () => {
    const hike = step({ type: 'hike', lat: 45.1, lng: 6.1, exitLat: 45.2, exitLng: 6.2 });
    const [point] = dayRoute(dayTimeline('2026-07-10', [hike], []));
    expect(point).toMatchObject({ entry: { lat: 45.1, lng: 6.1 }, exit: { lat: 45.2, lng: 6.2 } });
  });

  it('ignore un dossier vide (il n’a pas de point)', () => {
    const g = step({ kind: 'group', type: null, lat: null, lng: null });
    expect(dayRoute(dayTimeline('2026-07-10', [g], []))).toEqual([]);
  });
});

describe('isDayEmpty', () => {
  it('un jour est vide sans notes ni étape', () => {
    expect(isDayEmpty({ notes: '' }, 0)).toBe(true);
    expect(isDayEmpty({ notes: '   ' }, 0)).toBe(true);
  });

  it('un jour avec des notes ou des étapes n’est pas vide', () => {
    expect(isDayEmpty({ notes: 'Marché' }, 0)).toBe(false);
    expect(isDayEmpty({ notes: '' }, 2)).toBe(false);
  });
});
