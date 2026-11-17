import { describe, expect, it, vi } from 'vitest';
import { ALICE, BOB, addMember, addStep, call, createTrip, makeCaller } from './helpers';

/** Le cache D1 n'est pas isolé entre les tests : chaque test cherche sa propre destination. */
let n = 0;
const uniqueQuery = (base: string) => `${base} ${Date.now()}-${n++}`;

function commonsPage(index: number) {
  return {
    index,
    title: `File:Photo ${index}.jpg`,
    imageinfo: [
      {
        url: `https://upload.wikimedia.org/x/${index}.jpg`,
        thumburl: `https://upload.wikimedia.org/thumb/x/${index}.jpg/1280px-${index}.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Photo_${index}.jpg`,
        width: 4000,
        height: 2600,
        mime: 'image/jpeg',
        extmetadata: {
          Artist: { value: 'Jean Dupont' },
          LicenseShortName: { value: 'CC BY-SA 4.0' },
        },
      },
    ],
  };
}

function fakeCommons(status = 200, pages = [commonsPage(1), commonsPage(2)]) {
  return vi.fn(
    async () => new Response(JSON.stringify({ query: { pages } }), { status }),
  ) as unknown as typeof fetch & { mock: { calls: [string, RequestInit][] } };
}

/** Appelant au binding COMMONS_URL fixé : un test ne dépend jamais de `.dev.vars`. */
const coverCaller = (fetcher: typeof fetch, bindings: Record<string, string | undefined> = {}) =>
  makeCaller(fetcher, { COMMONS_URL: undefined, ...bindings });

const cover = {
  url: 'https://upload.wikimedia.org/thumb/x/1.jpg/1280px-1.jpg',
  thumbUrl: 'https://upload.wikimedia.org/thumb/x/1.jpg/640px-1.jpg',
  author: 'Jean Dupont',
  license: 'CC BY-SA 4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo_1.jpg',
};

describe('GET /api/covers', () => {
  it('cherche des photos sur Wikimedia Commons, avec un User-Agent identifié', async () => {
    const fetcher = fakeCommons();
    const q = uniqueQuery('Alpes');
    const res = await coverCaller(fetcher)(ALICE, 'GET', `/api/covers?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
    expect(res.body.covers).toHaveLength(2);
    expect(res.body.covers[0]).toEqual(cover);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toMatch(/^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/);
    expect(new URL(String(url)).searchParams.get('gsrsearch')).toBe(`${q} filetype:bitmap`);
    expect(new Headers(init.headers).get('user-agent')).toMatch(/^MyTrips\//);
  });

  it('met la réponse en cache : la même recherche ne rappelle pas Commons', async () => {
    const fetcher = fakeCommons();
    const q = encodeURIComponent(uniqueQuery('Annecy'));
    await coverCaller(fetcher)(ALICE, 'GET', `/api/covers?q=${q}`);
    const again = await coverCaller(fetcher)(BOB, 'GET', `/api/covers?q=${q}`);
    expect(again.status).toBe(200);
    expect(again.body.covers).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('utilise COMMONS_URL (services factices des e2e)', async () => {
    const fetcher = fakeCommons();
    const q = encodeURIComponent(uniqueQuery('Lyon'));
    await coverCaller(fetcher, { COMMONS_URL: 'http://localhost:8798/commons' })(
      ALICE,
      'GET',
      `/api/covers?q=${q}`,
    );
    expect(String(fetcher.mock.calls[0]![0])).toMatch(/^http:\/\/localhost:8798\/commons\/w\//);
  });

  it('recherche vide ou trop longue : 400 invalid_query', async () => {
    const caller = coverCaller(fakeCommons());
    expect((await caller(ALICE, 'GET', '/api/covers?q=')).body.error).toBe('invalid_query');
    expect((await caller(ALICE, 'GET', `/api/covers?q=${'a'.repeat(101)}`)).status).toBe(400);
  });

  it('Commons en erreur : 502, et rien n’est mis en cache', async () => {
    const q = encodeURIComponent(uniqueQuery('Nice'));
    const failing = fakeCommons(503);
    const res = await coverCaller(failing)(ALICE, 'GET', `/api/covers?q=${q}`);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('covers_unavailable');
    const ok = fakeCommons();
    expect((await coverCaller(ok)(ALICE, 'GET', `/api/covers?q=${q}`)).body.covers).toHaveLength(2);
  });
});

describe('photo de couverture du voyage', () => {
  it('un voyage n’a pas de photo à sa création', async () => {
    const snap = await createTrip();
    expect(snap.trip.cover).toBeNull();
  });

  it('PATCH enregistre la photo, la liste et le voyage la renvoient ; null l’efface', async () => {
    const snap = await createTrip();
    const id = snap.trip.id;
    const set = await call(ALICE, 'PATCH', `/api/trips/${id}`, { cover }, { 'if-match': '1' });
    expect(set.status).toBe(200);
    expect(set.body.trip.cover).toEqual(cover);
    const list = await call(ALICE, 'GET', '/api/trips');
    expect(list.body.trips.find((t: { id: string }) => t.id === id).cover).toEqual(cover);

    const cleared = await call(
      ALICE,
      'PATCH',
      `/api/trips/${id}`,
      { cover: null },
      { 'if-match': String(set.body.trip.version) },
    );
    expect(cleared.body.trip.cover).toBeNull();
  });

  it('refuse une photo mal formée', async () => {
    const snap = await createTrip();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${snap.trip.id}`,
      { cover: { ...cover, url: 'javascript:alert(1)' } },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(400);
  });

  it('refuse une photo hébergée ailleurs que sur Wikimedia (pas de pistage par l’image)', async () => {
    const snap = await createTrip();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${snap.trip.id}`,
      { cover: { ...cover, url: 'https://pisteur.example/pixel.jpg' } },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_cover');
    const thumb = await call(
      ALICE,
      'PATCH',
      `/api/trips/${snap.trip.id}`,
      { cover: { ...cover, thumbUrl: 'http://upload.wikimedia.org/x.jpg' } },
      { 'if-match': '1' },
    );
    expect(thumb.body.error).toBe('invalid_cover');
  });

  it('accepte les images de thumb.wikimedia.org et celles du service de COMMONS_URL', async () => {
    const snap = await createTrip();
    const thumbHost = {
      ...cover,
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/x.jpg/1280px-x.jpg',
      thumbUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/x.jpg/640px-x.jpg',
    };
    const ok = await call(
      ALICE,
      'PATCH',
      `/api/trips/${snap.trip.id}`,
      { cover: thumbHost },
      { 'if-match': '1' },
    );
    expect(ok.status).toBe(200);
    const mock = 'http://localhost:8798';
    const res = await makeCaller(undefined, { COMMONS_URL: `${mock}/commons` })(
      ALICE,
      'PATCH',
      `/api/trips/${snap.trip.id}`,
      {
        cover: {
          ...cover,
          url: `${mock}/commons-img/1.jpg`,
          thumbUrl: `${mock}/commons-img/1.jpg`,
          sourceUrl: `${mock}/commons-file/1`,
        },
      },
      { 'if-match': String(ok.body.trip.version) },
    );
    expect(res.status).toBe(200);
  });

  it('un lecteur ne peut pas changer la photo', async () => {
    const snap = await createTrip();
    await addMember(snap.trip.id, BOB, 'viewer');
    const res = await call(
      BOB,
      'PATCH',
      `/api/trips/${snap.trip.id}`,
      { cover },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(403);
  });
});

describe('liste des voyages : chiffres et lieux', () => {
  it('compte les étapes placées, additionne les distances et donne les trois premiers lieux', async () => {
    const snap = await createTrip(ALICE, { name: uniqueQuery('Chiffres') });
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
    const snap = await createTrip(ALICE, { name: uniqueQuery('Vide') });
    const list = await call(ALICE, 'GET', '/api/trips');
    const t = list.body.trips.find((x: { id: string }) => x.id === snap.trip.id);
    expect(t.stepCount).toBe(0);
    expect(t.distanceM).toBe(0);
    expect(t.places).toEqual([]);
  });
});
