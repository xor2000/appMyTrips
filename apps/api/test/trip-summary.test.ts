import { describe, expect, it } from 'vitest';
import { ALICE, addStep, call, createTrip } from './helpers';

/** La base n'est pas isolée entre les tests : noms de voyages uniques. */
let n = 0;
const uniqueName = (base: string) => `${base} ${Date.now()}-${n++}`;

describe('liste des voyages : chiffres et lieux', () => {
  it('compte les étapes placées, additionne les distances et donne les trois premiers lieux', async () => {
    const snap = await createTrip(ALICE, { name: uniqueName('Chiffres') });
    const id = snap.trip.id;
    const [d1, d2] = snap.days;
    let s = await addStep(id, snap.trip.version, {
      dayId: d1.id,
      name: 'MuCEM',
      type: 'museum',
      lat: 43.2967,
      lng: 5.361,
    });
    s = await addStep(id, s.trip.version, {
      dayId: d1.id,
      name: 'Vieux-Port',
      type: 'monument',
      lat: 43.295,
      lng: 5.374,
    });
    s = await addStep(id, s.trip.version, {
      dayId: d2.id,
      name: 'Aéroport',
      type: 'airport',
      lat: 43.4393,
      lng: 5.2214,
    });
    s = await addStep(id, s.trip.version, {
      dayId: d2.id,
      name: 'Chalet',
      type: 'hotel',
      lat: 45.85,
      lng: 6.25,
    });
    // Une idée (sans jour) ne compte pas.
    s = await addStep(id, s.trip.version, {
      dayId: null,
      name: 'Idée',
      type: 'other',
      lat: 45,
      lng: 6,
    });
    const [a, b] = s.steps.filter((x: { dayId: string | null }) => x.dayId === d1.id);
    const leg = await call(
      ALICE,
      'POST',
      `/api/trips/${id}/legs`,
      { fromKey: a.id, toKey: b.id, mode: 'walk', distanceM: 1200, durationMin: 15 },
      { 'if-match': String(s.trip.version) },
    );
    expect(leg.status).toBe(201);

    const list = await call(ALICE, 'GET', '/api/trips');
    const t = list.body.trips.find((x: { id: string }) => x.id === id);
    expect(t.stepCount).toBe(4);
    expect(t.distanceM).toBe(1200);
    expect(t.places).toEqual(['MuCEM', 'Vieux-Port', 'Aéroport']);
  });

  it('voyage vide : zéro étape, zéro mètre, aucun lieu', async () => {
    const snap = await createTrip(ALICE, { name: uniqueName('Vide') });
    const list = await call(ALICE, 'GET', '/api/trips');
    const t = list.body.trips.find((x: { id: string }) => x.id === snap.trip.id);
    expect(t.stepCount).toBe(0);
    expect(t.distanceM).toBe(0);
    expect(t.places).toEqual([]);
  });
});
