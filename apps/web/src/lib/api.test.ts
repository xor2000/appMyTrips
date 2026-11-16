import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  createLeg,
  createStay,
  createStep,
  deleteLeg,
  deleteStay,
  deleteStep,
  explorePois,
  poiWiki,
  reversePlace,
  searchPlaces,
  updateLeg,
  updateStay,
  updateStep,
  createTrip,
  deleteMember,
  deleteTrip,
  fetchMe,
  getTrip,
  listTrips,
  putMember,
  updateDay,
  updateTrip,
} from './api';

const json = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

const empty = (status: number) => vi.fn().mockResolvedValue(new Response(null, { status }));

/** Arguments du premier appel à fetch : URL et options. */
function firstCall(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as [string, RequestInit];
}

describe('fetchMe', () => {
  it('renvoie l’e-mail de l’utilisateur', async () => {
    const fetcher = json(200, { email: 'alice@example.test' });
    expect(await fetchMe(fetcher)).toEqual({ email: 'alice@example.test' });
    expect(firstCall(fetcher)[0]).toBe('/api/me');
  });

  it('renvoie null sur une réponse 401', async () => {
    expect(await fetchMe(json(401, { error: 'unauthorized' }))).toBeNull();
  });

  it('renvoie null sur une réponse inattendue', async () => {
    expect(await fetchMe(json(200, { mail: 'x' }))).toBeNull();
  });

  it('renvoie null quand le réseau échoue', async () => {
    expect(await fetchMe(vi.fn().mockRejectedValue(new TypeError('offline')))).toBeNull();
  });
});

describe('client des voyages', () => {
  it('liste les voyages', async () => {
    const fetcher = json(200, { trips: [{ id: '1' }] });
    expect(await listTrips(fetcher)).toEqual([{ id: '1' }]);
    expect(firstCall(fetcher)[0]).toBe('/api/trips');
  });

  it('crée un voyage en POST JSON', async () => {
    const fetcher = json(201, { trip: { id: '1' } });
    await createTrip({ name: 'Alpes', startDate: '2026-07-10', endDate: '2026-07-12' }, fetcher);
    const [url, init] = firstCall(fetcher);
    expect(url).toBe('/api/trips');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ name: 'Alpes' });
  });

  it('lit un voyage', async () => {
    const fetcher = json(200, { trip: { id: 'abc' } });
    await getTrip('abc', fetcher);
    expect(firstCall(fetcher)[0]).toBe('/api/trips/abc');
  });

  it('modifie un voyage avec If-Match, et ?force=true sur demande', async () => {
    const fetcher = json(200, {});
    await updateTrip('abc', 3, { name: 'X' }, { force: true }, fetcher);
    const [url, init] = firstCall(fetcher);
    expect(url).toBe('/api/trips/abc?force=true');
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('if-match')).toBe('3');
  });

  it('modifie un jour avec If-Match', async () => {
    const fetcher = json(200, {});
    await updateDay('abc', 'd1', 4, { notes: 'Lac' }, fetcher);
    const [url, init] = firstCall(fetcher);
    expect(url).toBe('/api/trips/abc/days/d1');
    expect(new Headers(init.headers).get('if-match')).toBe('4');
  });

  it('supprime un voyage (204)', async () => {
    const fetcher = empty(204);
    await expect(deleteTrip('abc', fetcher)).resolves.toBeUndefined();
    expect(firstCall(fetcher)[1].method).toBe('DELETE');
  });

  it('partage et retire un membre en encodant l’e-mail', async () => {
    const put = empty(204);
    await putMember('abc', 'bob+x@example.test', 'viewer', put);
    expect(firstCall(put)[0]).toBe('/api/trips/abc/members/bob%2Bx%40example.test');
    expect(JSON.parse(firstCall(put)[1].body as string)).toEqual({ role: 'viewer' });

    const del = empty(204);
    await deleteMember('abc', 'bob@example.test', del);
    expect(firstCall(del)[1].method).toBe('DELETE');
  });

  it('lève une ApiError avec le statut et le corps en cas d’échec', async () => {
    const fetcher = json(409, { error: 'days_not_empty', dates: ['2026-07-12'] });
    const error = await updateTrip('abc', 1, { name: 'X' }, {}, fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'days_not_empty',
      body: { dates: ['2026-07-12'] },
    });
  });
});

describe('client des étapes et séjours', () => {
  it('ajoute une étape avec If-Match', async () => {
    const fetcher = json(201, {});
    await createStep('t1', 2, { dayId: null, type: 'museum', name: 'X', lat: 1, lng: 2 }, fetcher);
    const [url, init] = firstCall(fetcher);
    expect(url).toBe('/api/trips/t1/steps');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('if-match')).toBe('2');
  });

  it('modifie une étape', async () => {
    const fetcher = json(200, {});
    await updateStep('t1', 's1', 3, { durationMin: 30 }, fetcher);
    const [url, init] = firstCall(fetcher);
    expect(url).toBe('/api/trips/t1/steps/s1');
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('if-match')).toBe('3');
  });

  it('supprime un dossier en précisant le sort de ses étapes', async () => {
    const fetcher = json(200, {});
    await deleteStep('t1', 'g1', 4, 'keep', fetcher);
    expect(firstCall(fetcher)[0]).toBe('/api/trips/t1/steps/g1?children=keep');
    const plain = json(200, {});
    await deleteStep('t1', 's1', 4, undefined, plain);
    expect(firstCall(plain)[0]).toBe('/api/trips/t1/steps/s1');
  });

  it('gère les séjours', async () => {
    const create = json(201, {});
    await createStay(
      't1',
      1,
      { name: 'H', lat: 1, lng: 2, checkInDate: '2026-07-10', checkOutDate: '2026-07-11' },
      create,
    );
    expect(firstCall(create)[0]).toBe('/api/trips/t1/stays');
    const update = json(200, {});
    await updateStay('t1', 'h1', 2, { name: 'H2' }, update);
    expect(firstCall(update)[0]).toBe('/api/trips/t1/stays/h1');
    const del = json(200, {});
    await deleteStay('t1', 'h1', 3, del);
    expect(firstCall(del)[1].method).toBe('DELETE');
  });
});

describe('recherche de lieux', () => {
  it('cherche avec le centre de la carte', async () => {
    const fetcher = json(200, { results: [{ name: 'Louvre' }] });
    expect(await searchPlaces('Musée du Louvre', { lat: 48.8, lng: 2.3 }, fetcher)).toEqual([
      { name: 'Louvre' },
    ]);
    const url = new URL(firstCall(fetcher)[0], 'http://x');
    expect(url.pathname).toBe('/api/geocode');
    expect(url.searchParams.get('q')).toBe('Musée du Louvre');
    expect(url.searchParams.get('lat')).toBe('48.8');
    expect(url.searchParams.get('lng')).toBe('2.3');
  });

  it('géocode un point', async () => {
    const fetcher = json(200, { result: { name: 'Ici' } });
    expect(await reversePlace({ lat: 1, lng: 2 }, fetcher)).toEqual({ name: 'Ici' });
    expect(firstCall(fetcher)[0]).toBe('/api/geocode/reverse?lat=1&lng=2');
  });
});

describe('découverte de lieux', () => {
  it('explore la zone visible pour les catégories choisies', async () => {
    const fetcher = json(200, { pois: [{ name: 'Louvre' }], source: 'cache' });
    const pois = await explorePois(
      { bbox: { west: 2.3, south: 48.84, east: 2.38, north: 48.88 }, zoom: 13.4 },
      ['restaurant', 'museum'],
      fetcher,
    );
    expect(pois).toEqual([{ name: 'Louvre' }]);
    const url = new URL(firstCall(fetcher)[0], 'http://x');
    expect(url.pathname).toBe('/api/poi');
    expect(url.searchParams.get('bbox')).toBe('2.3,48.84,2.38,48.88');
    expect(url.searchParams.get('zoom')).toBe('13.4');
    expect(url.searchParams.get('categories')).toBe('restaurant,museum');
  });

  it('traduit les refus de l’exploration en messages', async () => {
    await expect(
      explorePois(
        { bbox: { west: 0, south: 0, east: 1, north: 1 }, zoom: 12 },
        ['museum'],
        json(400, { error: 'area_too_large' }),
      ),
    ).rejects.toThrow('Zone trop grande : zoomez pour explorer.');
    await expect(
      explorePois(
        { bbox: { west: 0, south: 0, east: 1, north: 1 }, zoom: 12 },
        ['museum'],
        json(503, { error: 'poi_unavailable' }),
      ),
    ).rejects.toThrow(/indisponible/);
  });

  it('charge le résumé Wikipédia d’un lieu', async () => {
    const fetcher = json(200, { summary: { title: 'Louvre' } });
    expect(await poiWiki('fr:Musée du Louvre', fetcher)).toEqual({ title: 'Louvre' });
    expect(firstCall(fetcher)[0]).toBe('/api/poi/wiki?ref=fr%3AMus%C3%A9e+du+Louvre');
  });
});

describe('trajets', () => {
  it('crée, modifie et supprime un trajet avec la version du voyage', async () => {
    const create = json(201, { trip: { version: 3 } });
    await createLeg('t1', 2, { fromKey: 'a', toKey: 'b', mode: 'car' }, create);
    expect(firstCall(create)[0]).toBe('/api/trips/t1/legs');
    expect(firstCall(create)[1].method).toBe('POST');
    expect(new Headers(firstCall(create)[1].headers).get('if-match')).toBe('2');

    const update = json(200, {});
    await updateLeg('t1', 'l1', 3, { durationMin: 45 }, update);
    expect(firstCall(update)[0]).toBe('/api/trips/t1/legs/l1');
    expect(JSON.parse(String(firstCall(update)[1].body))).toEqual({ durationMin: 45 });

    const remove = json(200, {});
    await deleteLeg('t1', 'l1', 4, remove);
    expect(firstCall(remove)[1].method).toBe('DELETE');
  });

  it('aucun itinéraire : message invitant à la saisie manuelle', async () => {
    await expect(
      createLeg(
        't1',
        2,
        { fromKey: 'a', toKey: 'b', mode: 'bus' },
        json(422, { error: 'no_route' }),
      ),
    ).rejects.toThrow('Aucun itinéraire trouvé : indiquez la durée à la main.');
  });
});
