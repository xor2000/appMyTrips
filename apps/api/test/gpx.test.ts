import { describe, expect, it } from 'vitest';
import { ALICE, BOB, addStep, call, createTrip, addMember } from './helpers';

/** Rando de 12,4 km et 620 m de D+, du lac (45,90 ; 6,13) au sommet (45,95 ; 6,20). */
const GPX = {
  stats: {
    distanceM: 12_400,
    ascentM: 620,
    descentM: 20,
    minEle: 450,
    maxEle: 1070,
    isLoop: false,
    pointCount: 1200,
  },
  track: [
    [45.9, 6.13, 450],
    [45.92, 6.16, 760],
    [45.95, 6.2, 1070],
  ],
};

const v = (snapshot: { trip: { version: number } }) => ({
  'if-match': String(snapshot.trip.version),
});
const stepOf = (snapshot: { steps: { id: string; name: string }[] }, name: string) =>
  snapshot.steps.find((s) => s.name === name)!;

async function tripWithHike(extra: Record<string, unknown> = {}, tripOverrides = {}) {
  const t = await createTrip(ALICE, tripOverrides);
  const dayId = t.days[0].id;
  const s = await addStep(t.trip.id, t.trip.version, {
    dayId,
    type: 'hike',
    name: 'Tournette',
    gpx: GPX,
    ...extra,
  });
  return { tripId: t.trip.id as string, dayId, snapshot: s, hike: stepOf(s, 'Tournette') as any };
}

describe('randonnée GPX', () => {
  it('création avec un GPX : points d’entrée et de sortie, tracé et durée à 3,5 km/h', async () => {
    const { hike } = await tripWithHike();
    expect(hike).toMatchObject({
      type: 'hike',
      lat: 45.9,
      lng: 6.13,
      exitLat: 45.95,
      exitLng: 6.2,
      durationMin: 215,
      useElevation: false,
      durationManual: false,
      timezone: 'Europe/Paris',
    });
    expect(hike.gpx.stats.ascentM).toBe(620);
    expect(hike.gpx.track).toHaveLength(3);
  });

  it('avec le dénivelé et la vitesse du voyage', async () => {
    expect((await tripWithHike({ useElevation: true })).hike.durationMin).toBe(275);
    expect((await tripWithHike({}, { hikeSpeedKmh: 5 })).hike.durationMin).toBe(150);
  });

  it('une durée saisie à la création est gardée (durée manuelle)', async () => {
    const { hike } = await tripWithHike({ durationMin: 300 });
    expect(hike).toMatchObject({ durationMin: 300, durationManual: true });
  });

  it('refuse un GPX sur une étape qui n’est pas une randonnée, ou un tracé invalide (400)', async () => {
    const t = await createTrip();
    const notHike = await call(
      ALICE,
      'POST',
      `/api/trips/${t.trip.id}/steps`,
      { dayId: t.days[0].id, type: 'museum', name: 'Musée', lat: 45, lng: 6, gpx: GPX },
      v(t),
    );
    expect(notHike.status).toBe(400);
    const bad = await call(
      ALICE,
      'POST',
      `/api/trips/${t.trip.id}/steps`,
      { dayId: t.days[0].id, type: 'hike', name: 'Rando', gpx: { ...GPX, track: [[45, 6, null]] } },
      v(t),
    );
    expect(bad.status).toBe(400);
  });

  it('cocher le dénivelé recalcule la durée ; une durée saisie devient manuelle, puis le dénivelé la recalcule', async () => {
    const t = await tripWithHike();
    const path = `/api/trips/${t.tripId}/steps/${t.hike.id}`;
    const withEle = await call(ALICE, 'PATCH', path, { useElevation: true }, v(t.snapshot));
    expect(stepOf(withEle.body, 'Tournette')).toMatchObject({
      durationMin: 275,
      useElevation: true,
    });
    const manual = await call(ALICE, 'PATCH', path, { durationMin: 200 }, v(withEle.body));
    expect(stepOf(manual.body, 'Tournette')).toMatchObject({
      durationMin: 200,
      durationManual: true,
    });
    const back = await call(ALICE, 'PATCH', path, { useElevation: false }, v(manual.body));
    expect(stepOf(back.body, 'Tournette')).toMatchObject({
      durationMin: 215,
      durationManual: false,
    });
  });

  it('remplacer le GPX déplace les points et retire les trajets calculés adjacents', async () => {
    const t = await tripWithHike();
    const next = await addStep(t.tripId, t.snapshot.trip.version, {
      dayId: t.dayId,
      type: 'cafe',
      name: 'Refuge',
      lat: 45.96,
      lng: 6.21,
    });
    const leg = await call(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.hike.id, toKey: stepOf(next, 'Refuge').id, mode: 'plane' },
      v(next),
    );
    expect(leg.body.legs).toHaveLength(1);
    const other = {
      ...GPX,
      track: [
        [45.8, 6.1, 400],
        [45.85, 6.15, 900],
      ],
    };
    const res = await call(
      ALICE,
      'PUT',
      `/api/trips/${t.tripId}/steps/${t.hike.id}/gpx`,
      { gpx: other },
      v(leg.body),
    );
    expect(res.status).toBe(200);
    expect(stepOf(res.body, 'Tournette')).toMatchObject({ lat: 45.8, exitLat: 45.85 });
    expect(res.body.legs).toEqual([]);
  });

  it('le trajet suivant part du point d’arrivée du tracé', async () => {
    const t = await tripWithHike();
    const next = await addStep(t.tripId, t.snapshot.trip.version, {
      dayId: t.dayId,
      type: 'cafe',
      name: 'Refuge',
      lat: 45.96,
      lng: 6.21,
    });
    const route = await call(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      {
        fromKey: t.hike.id,
        toKey: stepOf(next, 'Refuge').id,
        mode: 'walk',
      },
      v(next),
    );
    // Sans clé ORS : estimation en ligne droite depuis la sortie du tracé.
    const leg = route.body.legs[0];
    expect(leg.distanceSource).toBe('estimate');
    expect(leg.distanceM).toBeLessThan(3000);
  });

  it('retirer le GPX : plus de tracé ni de point de sortie', async () => {
    const t = await tripWithHike();
    const res = await call(
      ALICE,
      'DELETE',
      `/api/trips/${t.tripId}/steps/${t.hike.id}/gpx`,
      undefined,
      v(t.snapshot),
    );
    expect(res.status).toBe(200);
    expect(stepOf(res.body, 'Tournette')).toMatchObject({
      gpx: null,
      exitLat: null,
      exitLng: null,
    });
  });

  it('droits et version : viewer refusé, If-Match obligatoire, étape inconnue', async () => {
    const t = await tripWithHike();
    const path = `/api/trips/${t.tripId}/steps/${t.hike.id}/gpx`;
    expect((await call(ALICE, 'PUT', path, { gpx: GPX })).status).toBe(428);
    await addMember(t.tripId, BOB, 'viewer');
    expect((await call(BOB, 'PUT', path, { gpx: GPX }, v(t.snapshot))).status).toBe(403);
    expect(
      (
        await call(
          ALICE,
          'PUT',
          `/api/trips/${t.tripId}/steps/${crypto.randomUUID()}/gpx`,
          { gpx: GPX },
          v(t.snapshot),
        )
      ).status,
    ).toBe(404);
  });
});
