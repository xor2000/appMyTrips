import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
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
