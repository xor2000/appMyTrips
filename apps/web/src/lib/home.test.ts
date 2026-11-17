import { describe, expect, it } from 'vitest';
import { makeLeg, makeStep, makeTripSummary } from '#lib/test/fixtures.ts';
import { groupTrips, normalizeTripSummary, summaryFromSnapshot } from './home';

const trip = (id: string, startDate: string, endDate: string) =>
  makeTripSummary({ id, name: id, startDate, endDate });

describe('groupTrips', () => {
  const today = '2026-11-17';

  it('met en avant le voyage en cours, puis les autres à venir, puis les souvenirs', () => {
    const groups = groupTrips(
      [
        trip('passé ancien', '2026-03-01', '2026-03-05'),
        trip('à venir loin', '2027-06-02', '2027-06-09'),
        trip('en cours', '2026-11-15', '2026-11-18'),
        trip('à venir proche', '2027-02-20', '2027-02-24'),
        trip('passé récent', '2026-07-10', '2026-07-12'),
      ],
      today,
    );
    expect(groups.next?.name).toBe('en cours');
    expect(groups.upcoming.map((t) => t.name)).toEqual(['à venir proche', 'à venir loin']);
    expect(groups.past.map((t) => t.name)).toEqual(['passé récent', 'passé ancien']);
  });

  it('sans voyage en cours : le prochain départ est mis en avant', () => {
    const groups = groupTrips(
      [trip('B', '2027-06-02', '2027-06-09'), trip('A', '2027-02-20', '2027-02-24')],
      today,
    );
    expect(groups.next?.name).toBe('A');
    expect(groups.upcoming.map((t) => t.name)).toEqual(['B']);
  });

  it('que des souvenirs : rien en avant', () => {
    const groups = groupTrips([trip('A', '2026-07-10', '2026-07-12')], today);
    expect(groups.next).toBeNull();
    expect(groups.upcoming).toEqual([]);
    expect(groups.past.map((t) => t.name)).toEqual(['A']);
  });
});

describe('normalizeTripSummary', () => {
  it('complète une copie hors ligne enregistrée avant les photos et les chiffres', () => {
    const old = { ...makeTripSummary() } as Partial<ReturnType<typeof makeTripSummary>>;
    delete old.cover;
    delete old.stepCount;
    delete old.distanceM;
    delete old.places;
    const t = normalizeTripSummary(old as ReturnType<typeof makeTripSummary>);
    expect(t.cover).toBeNull();
    expect(t.stepCount).toBe(0);
    expect(t.distanceM).toBe(0);
    expect(t.places).toEqual([]);
  });
});

describe('summaryFromSnapshot', () => {
  it('calcule chiffres et lieux comme l’API', () => {
    const t = makeTripSummary();
    const summary = summaryFromSnapshot({
      trip: t,
      role: 'owner',
      days: [
        { id: 'd1', date: '2026-07-10', dayStart: null, dayEnd: null, notes: '' },
        { id: 'd2', date: '2026-07-11', dayStart: null, dayEnd: null, notes: '' },
      ],
      members: [],
      steps: [
        makeStep({ id: 'a', dayId: 'd2', name: 'Chalet', position: 'a0' }),
        makeStep({ id: 'b', dayId: 'd1', name: 'MuCEM', position: 'a1' }),
        makeStep({ id: 'c', dayId: 'd1', name: 'Vieux-Port', position: 'a0' }),
        makeStep({ id: 'g', dayId: 'd1', kind: 'group', name: 'Dossier', position: 'a2' }),
        makeStep({ id: 'i', dayId: null, name: 'Idée' }),
      ],
      stays: [],
      legs: [makeLeg({ distanceM: 1200 }), makeLeg({ distanceM: null })],
    });
    expect(summary.dayCount).toBe(2);
    expect(summary.stepCount).toBe(3);
    expect(summary.distanceM).toBe(1200);
    expect(summary.places).toEqual(['Vieux-Port', 'MuCEM', 'Chalet']);
  });
});
