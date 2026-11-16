import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { ALICE, BOB, addStep, call, createTrip, makeCaller } from './helpers';

/** Points uniques par test : le cache des itinéraires (D1) est partagé entre les tests. */
let seed = 0;
function place() {
  seed += 1;
  const lat = 45.5 + seed * 0.01;
  const lng = 5.5 + (seed % 7) * 0.013;
  return { lat, lng };
}

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;
function fakeFetch(route: Route) {
  return vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) =>
    route(String(input), init),
  ) as unknown as typeof fetch & { mock: { calls: [string, RequestInit][] } };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const ORS_BASE = 'https://api.heigit.org/openrouteservice';

function orsResponse(distance = 72_000, duration = 4_500) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { summary: { distance, duration } },
        geometry: {
          type: 'LineString',
          coordinates: [
            [6.1, 45.9],
            [6.5, 45.95],
            [6.87, 45.92],
          ],
        },
      },
    ],
  };
}

/** Polyligne (précision 6) de deux points, comme en renvoie Transitous. */
const TRANSIT_LINE = '_p~iF~ps|U_ulLnnqC';

function transitousResponse(itineraries: unknown[]) {
  return { itineraries, direct: [] };
}

const TER_ITINERARY = {
  duration: 5100,
  transfers: 0,
  legs: [
    {
      mode: 'WALK',
      duration: 60,
      distance: 46,
      legGeometry: { points: TRANSIT_LINE, precision: 6, length: 2 },
    },
    {
      mode: 'REGIONAL_RAIL',
      duration: 4980,
      displayName: 'TER 17611',
      routeShortName: '',
      legGeometry: { points: TRANSIT_LINE, precision: 6, length: 2 },
    },
  ],
};

/** Appelant aux bindings de routage fixés (indépendant de `.dev.vars`). */
const routeCaller = (fetcher: typeof fetch, bindings: Record<string, string | undefined> = {}) =>
  makeCaller(fetcher, {
    ORS_API_KEY: 'cle-ors-test',
    ORS_URL: undefined,
    TRANSITOUS_URL: undefined,
    CONTACT_URL: undefined,
    ...bindings,
  });

/** Voyage avec trois étapes a, b, c (dans cet ordre) sur J1. */
async function tripWithSteps() {
  const t = await createTrip();
  const dayId = t.days[0].id;
  let s = t;
  for (const name of ['A', 'B', 'C']) {
    s = await addStep(t.trip.id, s.trip.version, { dayId, type: 'museum', name, ...place() });
  }
  const id = (name: string) => s.steps.find((x: { name: string }) => x.name === name).id;
  return { trip: s, tripId: t.trip.id as string, dayId, a: id('A'), b: id('B'), c: id('C') };
}

const v = (snapshot: { trip: { version: number } }) => ({
  'if-match': String(snapshot.trip.version),
});

describe('trajets : création', () => {
  it.each([
    ['car', 'driving-car'],
    ['bike', 'cycling-regular'],
    ['walk', 'foot-walking'],
  ])(
    '%s : itinéraire OpenRouteService (profil %s), distance, durée et tracé',
    async (mode, profile) => {
      const t = await tripWithSteps();
      const fetcher = fakeFetch(() => json(orsResponse()));
      const res = await routeCaller(fetcher)(
        ALICE,
        'POST',
        `/api/trips/${t.tripId}/legs`,
        { fromKey: t.a, toKey: t.b, mode },
        v(t.trip),
      );
      expect(res.status).toBe(201);
      expect(res.body.legs).toHaveLength(1);
      expect(res.body.legs[0]).toMatchObject({
        fromKey: t.a,
        toKey: t.b,
        mode,
        distanceM: 72_000,
        durationMin: 75,
        distanceSource: 'router',
        durationSource: 'router',
      });
      expect(res.body.legs[0].geometry).toEqual(expect.any(String));
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).toBe(`${ORS_BASE}/v2/directions/${profile}/geojson`);
      expect(new Headers(init.headers).get('authorization')).toBe('cle-ors-test');
      const body = JSON.parse(String(init.body));
      const a = t.trip.steps.find((s: { id: string }) => s.id === t.a);
      expect(body.coordinates[0]).toEqual([a.lng, a.lat]);
    },
  );

  it.each([403, 429, 500])('ORS en erreur (%i) : estimation locale signalée', async (status) => {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json({ error: 'refus' }, status));
    const res = await routeCaller(fetcher)(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'car' },
      v(t.trip),
    );
    expect(res.status).toBe(201);
    expect(res.body.legs[0]).toMatchObject({
      distanceSource: 'estimate',
      durationSource: 'estimate',
    });
  });

  it('sans clé ORS : estimation locale, sans appel réseau', async () => {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json(orsResponse()));
    const res = await routeCaller(fetcher, { ORS_API_KEY: undefined })(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'car' },
      v(t.trip),
    );
    expect(res.body.legs[0].durationSource).toBe('estimate');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('aucune route (ORS 404) : 422 no_route, sauf durée saisie', async () => {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json({ error: { code: 2010 } }, 404));
    const caller = routeCaller(fetcher);
    const res = await caller(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'car' },
      v(t.trip),
    );
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('no_route');
    const manual = await caller(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'car', durationMin: 40 },
      v(t.trip),
    );
    expect(manual.status).toBe(201);
    expect(manual.body.legs[0]).toMatchObject({
      durationMin: 40,
      durationSource: 'manual',
      distanceM: null,
    });
  });

  it('train : itinéraire Transitous (départ estimé 09:00 heure locale), lignes résumées', async () => {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json(transitousResponse([TER_ITINERARY])));
    const res = await routeCaller(fetcher, { CONTACT_URL: 'https://example.test/mytrips' })(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'train' },
      v(t.trip),
    );
    expect(res.status).toBe(201);
    expect(res.body.legs[0]).toMatchObject({
      mode: 'train',
      durationMin: 85,
      summary: 'TER 17611',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://api.transitous.org/api/v5/plan');
    // 10 juillet 2026, 09:00 à Paris (UTC+2).
    expect(u.searchParams.get('time')).toBe('2026-07-10T07:00:00.000Z');
    expect(u.searchParams.get('fromPlace')).toMatch(/^45\.\d+,5\.\d+$/);
    expect(new Headers(init.headers).get('user-agent')).toBe(
      'MyTrips/0.1 (+https://example.test/mytrips)',
    );
  });

  it('TRANSITOUS_URL avec un chemin (relais) : le chemin est conservé', async () => {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json(transitousResponse([TER_ITINERARY])));
    await routeCaller(fetcher, { TRANSITOUS_URL: 'http://relais.test/transitous/' })(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'train' },
      v(t.trip),
    );
    const u = new URL(fetcher.mock.calls[0]![0]);
    expect(u.origin + u.pathname).toBe('http://relais.test/transitous/api/v5/plan');
  });

  it('train : retient l’itinéraire le plus court, puis le moins de correspondances', async () => {
    const t = await tripWithSteps();
    const slow = { ...TER_ITINERARY, duration: 9000 };
    const sameWithTransfer = {
      ...TER_ITINERARY,
      transfers: 1,
      legs: [{ ...TER_ITINERARY.legs[1], displayName: 'IC 1' }],
    };
    const fetcher = fakeFetch(() =>
      json(transitousResponse([slow, sameWithTransfer, TER_ITINERARY])),
    );
    const res = await routeCaller(fetcher)(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'train' },
      v(t.trip),
    );
    expect(res.body.legs[0].summary).toBe('TER 17611');
  });

  it('bus sans itinéraire Transitous : 422 no_route', async () => {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json(transitousResponse([])));
    const res = await routeCaller(fetcher)(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'bus' },
      v(t.trip),
    );
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('no_route');
  });

  it.each(['plane', 'ferry'])('%s : calcul local, sans appel réseau', async (mode) => {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json({}));
    const res = await routeCaller(fetcher)(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode },
      v(t.trip),
    );
    expect(res.status).toBe(201);
    expect(res.body.legs[0].durationSource).toBe('router');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuse une paire qui n’est pas consécutive (400 invalid_leg)', async () => {
    const t = await tripWithSteps();
    const res = await routeCaller(fakeFetch(() => json(orsResponse())))(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.c, mode: 'car' },
      v(t.trip),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_leg');
  });

  it('remplace le trajet existant de la même paire', async () => {
    const t = await tripWithSteps();
    const caller = routeCaller(fakeFetch(() => json(orsResponse())));
    const first = await caller(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'car' },
      v(t.trip),
    );
    const second = await caller(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'plane' },
      v(first.body),
    );
    expect(second.body.legs).toHaveLength(1);
    expect(second.body.legs[0].mode).toBe('plane');
  });

  it('droits et version : If-Match obligatoire, viewer refusé, conflit de version', async () => {
    const t = await tripWithSteps();
    const caller = routeCaller(fakeFetch(() => json(orsResponse())));
    const leg = { fromKey: t.a, toKey: t.b, mode: 'plane' };
    expect((await caller(ALICE, 'POST', `/api/trips/${t.tripId}/legs`, leg)).status).toBe(428);
    await call(ALICE, 'PUT', `/api/trips/${t.tripId}/members/${BOB}`, { role: 'viewer' });
    expect((await caller(BOB, 'POST', `/api/trips/${t.tripId}/legs`, leg, v(t.trip))).status).toBe(
      403,
    );
    const stale = await caller(ALICE, 'POST', `/api/trips/${t.tripId}/legs`, leg, {
      'if-match': '1',
    });
    expect(stale.status).toBe(409);
  });
});

describe('trajets : modification et suppression', () => {
  async function tripWithLeg() {
    const t = await tripWithSteps();
    const fetcher = fakeFetch(() => json(orsResponse()));
    const caller = routeCaller(fetcher);
    const res = await caller(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'car' },
      v(t.trip),
    );
    return { ...t, caller, fetcher, snapshot: res.body, leg: res.body.legs[0] };
  }

  it('forcer la durée : mention manuelle, la distance reste celle du routeur', async () => {
    const t = await tripWithLeg();
    const res = await t.caller(
      ALICE,
      'PATCH',
      `/api/trips/${t.tripId}/legs/${t.leg.id}`,
      { durationMin: 45 },
      v(t.snapshot),
    );
    expect(res.status).toBe(200);
    expect(res.body.legs[0]).toMatchObject({
      durationMin: 45,
      durationSource: 'manual',
      distanceM: 72_000,
      distanceSource: 'router',
    });
  });

  it('recalculer : retour aux valeurs du routeur', async () => {
    const t = await tripWithLeg();
    const forced = await t.caller(
      ALICE,
      'PATCH',
      `/api/trips/${t.tripId}/legs/${t.leg.id}`,
      { durationMin: 45 },
      v(t.snapshot),
    );
    const res = await t.caller(
      ALICE,
      'PATCH',
      `/api/trips/${t.tripId}/legs/${t.leg.id}`,
      { distanceM: null, durationMin: null, recompute: true },
      v(forced.body),
    );
    expect(res.body.legs[0]).toMatchObject({ durationMin: 75, durationSource: 'router' });
  });

  it('notes et réservation sans nouveau calcul', async () => {
    const t = await tripWithLeg();
    const calls = t.fetcher.mock.calls.length;
    const res = await t.caller(
      ALICE,
      'PATCH',
      `/api/trips/${t.tripId}/legs/${t.leg.id}`,
      { bookingRef: 'PNR42', notes: 'Péage' },
      v(t.snapshot),
    );
    expect(res.body.legs[0]).toMatchObject({
      bookingRef: 'PNR42',
      notes: 'Péage',
      durationMin: 75,
    });
    expect(t.fetcher.mock.calls.length).toBe(calls);
  });

  it('supprime un trajet', async () => {
    const t = await tripWithLeg();
    const res = await t.caller(
      ALICE,
      'DELETE',
      `/api/trips/${t.tripId}/legs/${t.leg.id}`,
      undefined,
      v(t.snapshot),
    );
    expect(res.status).toBe(200);
    expect(res.body.legs).toEqual([]);
  });

  it('trajet d’un autre voyage : 404', async () => {
    const t = await tripWithLeg();
    const other = await createTrip();
    const res = await t.caller(
      ALICE,
      'DELETE',
      `/api/trips/${other.trip.id}/legs/${t.leg.id}`,
      undefined,
      v(other),
    );
    expect(res.status).toBe(404);
  });
});

describe('trajets caducs', () => {
  it('déplacer une étape supprime le trajet dont la paire n’est plus consécutive', async () => {
    const t = await tripWithSteps();
    const created = await routeCaller(fakeFetch(() => json({})))(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'plane' },
      v(t.trip),
    );
    const first = created.body.steps.find((s: { id: string }) => s.id === t.a).position;
    expect('Zz' < first).toBe(true);
    // B passe avant A : ordre B, A, C.
    const moved = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.tripId}/steps/${t.b}`,
      { position: 'Zz' },
      v(created.body),
    );
    expect(moved.status).toBe(200);
    expect(moved.body.legs).toEqual([]);
  });

  it('supprimer une étape supprime ses trajets', async () => {
    const t = await tripWithSteps();
    const created = await routeCaller(fakeFetch(() => json({})))(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'plane' },
      v(t.trip),
    );
    const res = await call(
      ALICE,
      'DELETE',
      `/api/trips/${t.tripId}/steps/${t.b}`,
      undefined,
      v(created.body),
    );
    expect(res.body.legs).toEqual([]);
  });

  it('un trajet toujours consécutif est conservé', async () => {
    const t = await tripWithSteps();
    const created = await routeCaller(fakeFetch(() => json({})))(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'plane' },
      v(t.trip),
    );
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.tripId}/steps/${t.c}`,
      { notes: 'Rien ne bouge' },
      v(created.body),
    );
    expect(res.body.legs).toHaveLength(1);
  });
});

describe('point déplacé', () => {
  it('changer le lieu d’une étape retire ses trajets calculés, garde ceux saisis à la main', async () => {
    const t = await tripWithSteps();
    const caller = routeCaller(fakeFetch(() => json({})));
    const ab = await caller(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.a, toKey: t.b, mode: 'plane' },
      v(t.trip),
    );
    const bc = await caller(
      ALICE,
      'POST',
      `/api/trips/${t.tripId}/legs`,
      { fromKey: t.b, toKey: t.c, mode: 'car', durationMin: 30 },
      v(ab.body),
    );
    const moved = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.tripId}/steps/${t.b}`,
      { lat: 46.5, lng: 6.6 },
      v(bc.body),
    );
    expect(moved.body.legs.map((l: { fromKey: string }) => l.fromKey)).toEqual([t.b]);
    expect(moved.body.legs[0].durationSource).toBe('manual');
  });

  it('changer le lieu d’un séjour retire ses trajets calculés', async () => {
    const t = await createTrip();
    const withStay = await call(
      ALICE,
      'POST',
      `/api/trips/${t.trip.id}/stays`,
      { name: 'Hôtel', ...place(), checkInDate: '2026-07-10', checkOutDate: '2026-07-11' },
      v(t),
    );
    const day2 = t.days[1].id;
    const s = await addStep(t.trip.id, withStay.body.trip.version, {
      dayId: day2,
      type: 'museum',
      name: 'Musée',
      ...place(),
    });
    const stay = s.stays[0];
    const fromKey = `stay:${stay.id}:2026-07-11:start`;
    const leg = await routeCaller(fakeFetch(() => json({})))(
      ALICE,
      'POST',
      `/api/trips/${t.trip.id}/legs`,
      { fromKey, toKey: s.steps[0].id, mode: 'plane' },
      v(s),
    );
    expect(leg.status).toBe(201);
    const moved = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}/stays/${stay.id}`,
      { lat: 46.1, lng: 6.2 },
      v(leg.body),
    );
    expect(moved.body.legs).toEqual([]);
  });
});

describe('POST /api/route', () => {
  it('calcule un itinéraire et le sert ensuite depuis le cache', async () => {
    const from = place();
    const to = place();
    const fetcher = fakeFetch(() => json(orsResponse(10_000, 900)));
    const caller = routeCaller(fetcher);
    const first = await caller(ALICE, 'POST', '/api/route', { mode: 'car', from, to });
    expect(first.status).toBe(200);
    expect(first.body.route).toMatchObject({
      distanceM: 10_000,
      durationMin: 15,
      source: 'router',
    });
    const second = await caller(ALICE, 'POST', '/api/route', { mode: 'car', from, to });
    expect(second.body.route).toEqual(first.body.route);
    expect(fetcher.mock.calls).toHaveLength(1);
  });

  it('cache expiré (plus de 30 jours) : nouveau calcul', async () => {
    const from = place();
    const to = place();
    const fetcher = fakeFetch(() => json(orsResponse(10_000, 900)));
    const caller = routeCaller(fetcher);
    await caller(ALICE, 'POST', '/api/route', { mode: 'walk', from, to });
    const old = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
    await env.DB.prepare("UPDATE route_cache SET created_at = ? WHERE key LIKE 'walk:%'")
      .bind(old)
      .run();
    await caller(ALICE, 'POST', '/api/route', { mode: 'walk', from, to });
    expect(fetcher.mock.calls).toHaveLength(2);
  });

  it('une estimation n’est pas mise en cache (une clé ajoutée plus tard sera utilisée)', async () => {
    const from = place();
    const to = place();
    const fetcher = fakeFetch(() => json(orsResponse()));
    await routeCaller(fetcher, { ORS_API_KEY: undefined })(ALICE, 'POST', '/api/route', {
      mode: 'car',
      from,
      to,
    });
    const res = await routeCaller(fetcher)(ALICE, 'POST', '/api/route', { mode: 'car', from, to });
    expect(res.body.route.source).toBe('router');
  });

  it('refuse une demande invalide (400)', async () => {
    const res = await call(ALICE, 'POST', '/api/route', { mode: 'car', from: { lat: 95, lng: 0 } });
    expect(res.status).toBe(400);
  });

  it('exige une identité (401)', async () => {
    const res = await call('', 'POST', '/api/route', {});
    expect(res.status).toBe(401);
  });
});
