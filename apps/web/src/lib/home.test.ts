import { describe, expect, it } from 'vitest';
import { makeLeg, makeStep, makeTripSummary } from '#lib/test/fixtures.ts';
import {
  LAST_TRIP_KEY,
  forgetLastTrip,
  groupTrips,
  normalizeTripSummary,
  pickStartTrip,
  readLastTrip,
  saveLastTrip,
  summaryFromSnapshot,
} from './home';

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
  it('complète une copie hors ligne enregistrée avant les illustrations et les chiffres', () => {
    const old = {
      ...makeTripSummary(),
      // Ancienne photo Wikimedia Commons, oubliée.
      cover: { url: 'https://upload.wikimedia.org/x.jpg' },
    } as Partial<ReturnType<typeof makeTripSummary>> & { cover?: unknown };
    delete old.illustration;
    delete old.stepCount;
    delete old.distanceM;
    delete old.places;
    const t = normalizeTripSummary(old as ReturnType<typeof makeTripSummary>);
    expect(t.illustration).toBeNull();
    expect(t).not.toHaveProperty('cover');
    expect(t.stepCount).toBe(0);
    expect(t.distanceM).toBe(0);
    expect(t.places).toEqual([]);
  });

  it('lit comme null une illustration inconnue (retirée de la liste)', () => {
    const t = normalizeTripSummary({
      ...makeTripSummary(),
      illustration: 'licorne' as never,
    });
    expect(t.illustration).toBeNull();
    expect(normalizeTripSummary(makeTripSummary({ illustration: 'van' })).illustration).toBe('van');
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

describe('pickStartTrip', () => {
  const today = '2026-11-17';
  const trips = [
    trip('passé ancien', '2026-03-01', '2026-03-05'),
    trip('passé récent', '2026-07-10', '2026-07-12'),
    trip('à venir', '2027-02-20', '2027-02-24'),
  ];

  it('ouvre le dernier voyage consulté s’il est encore dans la liste', () => {
    expect(pickStartTrip(trips, 'passé ancien', today)?.name).toBe('passé ancien');
  });

  it('dernier voyage inconnu (supprimé, plus partagé) : le voyage en cours ou le prochain', () => {
    expect(pickStartTrip(trips, 'disparu', today)?.name).toBe('à venir');
    expect(pickStartTrip(trips, null, today)?.name).toBe('à venir');
  });

  it('que des souvenirs : le plus récent', () => {
    expect(pickStartTrip(trips.slice(0, 2), null, today)?.name).toBe('passé récent');
  });

  it('aucun voyage : rien à ouvrir', () => {
    expect(pickStartTrip([], 'passé ancien', today)).toBeNull();
  });
});

describe('dernier voyage consulté', () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  it('est mémorisé par appareil, puis oublié', () => {
    const storage = memoryStorage();
    expect(readLastTrip(storage)).toBeNull();
    saveLastTrip('t1', storage);
    expect(storage.getItem(LAST_TRIP_KEY)).toBe('t1');
    expect(readLastTrip(storage)).toBe('t1');
    forgetLastTrip('autre', storage);
    expect(readLastTrip(storage)).toBe('t1');
    forgetLastTrip('t1', storage);
    expect(readLastTrip(storage)).toBeNull();
  });

  it('stockage bloqué : aucune erreur', () => {
    const blocked = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
      removeItem: () => {
        throw new Error('bloqué');
      },
    };
    expect(readLastTrip(blocked)).toBeNull();
    expect(() => saveLastTrip('t1', blocked)).not.toThrow();
    expect(() => forgetLastTrip('t1', blocked)).not.toThrow();
  });
});
