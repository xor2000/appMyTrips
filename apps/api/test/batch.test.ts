import { describe, expect, it } from 'vitest';
import { ALICE, BOB, addStep, call, createTrip } from './helpers';

/** Voyage de 3 jours avec deux étapes sur J1. */
async function tripWithSteps() {
  const t = await createTrip();
  const d1 = t.days[0].id;
  let s = await addStep(t.trip.id, t.trip.version, {
    dayId: d1,
    type: 'museum',
    name: 'A',
    lat: 45,
    lng: 6,
  });
  s = await addStep(t.trip.id, s.trip.version, {
    dayId: d1,
    type: 'museum',
    name: 'B',
    lat: 45.1,
    lng: 6.1,
  });
  const id = (name: string) => s.steps.find((x: { name: string }) => x.name === name).id;
  return { snapshot: s, tripId: t.trip.id as string, days: t.days, a: id('A'), b: id('B') };
}

const v = (snapshot: { trip: { version: number } }) => ({
  'if-match': String(snapshot.trip.version),
});

describe('POST /api/trips/:id/batch', () => {
  it('applique plusieurs modifications en une seule version', async () => {
    const t = await tripWithSteps();
    const res = await call(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/batch`,
      {
        ops: [
          { kind: 'step', id: t.a, patch: { durationMin: 100 } },
          { kind: 'step', id: t.b, patch: { dayId: t.days[1].id } },
          { kind: 'day', id: t.days[0].id, patch: { dayStart: '07:40' } },
        ],
      },
      v(t.snapshot),
    );
    expect(res.status).toBe(200);
    expect(res.body.trip.version).toBe(t.snapshot.trip.version + 1);
    const step = (id: string) => res.body.steps.find((s: { id: string }) => s.id === id);
    expect(step(t.a).durationMin).toBe(100);
    expect(step(t.b).dayId).toBe(t.days[1].id);
    expect(res.body.days[0].dayStart).toBe('07:40');
  });

  it('atomique : une opération invalide n’applique rien', async () => {
    const t = await tripWithSteps();
    const res = await call(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/batch`,
      {
        ops: [
          { kind: 'step', id: t.a, patch: { durationMin: 100 } },
          { kind: 'step', id: crypto.randomUUID(), patch: { durationMin: 10 } },
        ],
      },
      v(t.snapshot),
    );
    expect(res.status).toBe(404);
    const after = await call(ALICE, 'GET', `/api/trips/${t.tripId}`);
    expect(after.body.trip.version).toBe(t.snapshot.trip.version);
    expect(after.body.steps.find((s: { id: string }) => s.id === t.a).durationMin).toBe(120);
  });

  it('refuse des heures de jour incohérentes (400)', async () => {
    const t = await tripWithSteps();
    const res = await call(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/batch`,
      { ops: [{ kind: 'day', id: t.days[0].id, patch: { dayStart: '23:00' } }] },
      v(t.snapshot),
    );
    expect(res.status).toBe(400);
  });

  it('les trajets devenus caducs sont retirés', async () => {
    const t = await tripWithSteps();
    const leg = await call(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'plane' },
      v(t.snapshot),
    );
    const res = await call(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/batch`,
      { ops: [{ kind: 'step', id: t.b, patch: { dayId: null } }] },
      v(leg.body),
    );
    expect(res.body.legs).toEqual([]);
  });

  it('droits et version : If-Match obligatoire, viewer refusé, conflit, lot vide refusé', async () => {
    const t = await tripWithSteps();
    const body = { ops: [{ kind: 'step', id: t.a, patch: { durationMin: 90 } }] };
    expect((await call(ALICE, 'POST', `/api/trips/${t.tripId}/batch`, body)).status).toBe(428);
    await call(ALICE, 'PUT', `/api/trips/${t.tripId}/members/${BOB}`, { role: 'viewer' });
    expect(
      (await call(BOB, 'POST', `/api/trips/${t.tripId}/batch`, body, v(t.snapshot))).status,
    ).toBe(403);
    expect(
      (await call(ALICE, 'POST', `/api/trips/${t.tripId}/batch`, body, { 'if-match': '1' })).status,
    ).toBe(409);
    expect(
      (await call(ALICE, 'POST', `/api/trips/${t.tripId}/batch`, { ops: [] }, v(t.snapshot)))
        .status,
    ).toBe(400);
  });
});
