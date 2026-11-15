import { describe, expect, it } from 'vitest';
import { ALICE, BOB, CAROL, MALLORY, call, createTrip } from './helpers';

describe('POST /api/trips', () => {
  it('crée le voyage, ses jours, et en fait le propriétaire', async () => {
    const res = await call(ALICE, 'POST', '/api/trips', {
      name: '  Voyage test Alpes ',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      defaultTimezone: 'Europe/Zurich',
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('owner');
    expect(res.body.trip).toMatchObject({
      name: 'Voyage test Alpes',
      ownerEmail: ALICE,
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      dayStart: '08:00',
      dayEnd: '22:00',
      defaultTimezone: 'Europe/Zurich',
      hikeSpeedKmh: 3.5,
      version: 1,
    });
    expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
    expect(res.body.members).toEqual([]);
  });

  it('refuse des données invalides (400)', async () => {
    const invalid = [
      { name: '', startDate: '2026-07-10', endDate: '2026-07-12' },
      { name: 'X', startDate: '2026-07-12', endDate: '2026-07-10' },
      { name: 'X', startDate: '2026-02-30', endDate: '2026-03-01' },
      { name: 'X', startDate: '2026-01-01', endDate: '2026-12-31' },
      { name: 'X' },
    ];
    for (const body of invalid) {
      const res = await call(ALICE, 'POST', '/api/trips', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe('invalid');
    }
  });

  it('refuse un corps qui n’est pas du JSON (400)', async () => {
    const res = await call(ALICE, 'POST', '/api/trips', undefined, {});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/trips', () => {
  it('liste les voyages possédés et partagés, avec le rôle et le nombre de jours', async () => {
    const mine = await createTrip(ALICE, { name: 'À moi' });
    const shared = await createTrip(BOB, { name: 'De Bob', endDate: '2026-07-11' });
    await createTrip(CAROL, { name: 'De Carol' });
    await call(BOB, 'PUT', `/api/trips/${shared.trip.id}/members/${ALICE}`, { role: 'viewer' });

    const res = await call(ALICE, 'GET', '/api/trips');
    expect(res.status).toBe(200);
    const rows = res.body.trips.map((t: { name: string; role: string; dayCount: number }) => [
      t.name,
      t.role,
      t.dayCount,
    ]);
    expect(rows).toEqual(
      expect.arrayContaining([
        ['À moi', 'owner', 3],
        ['De Bob', 'viewer', 2],
      ]),
    );
    expect(rows.find((r: string[]) => r[0] === 'De Carol')).toBeUndefined();
    expect(mine.trip.id).toBeTruthy();
  });

  it('trie les voyages par date de début', async () => {
    await createTrip(ALICE, { name: 'Août', startDate: '2026-08-01', endDate: '2026-08-02' });
    await createTrip(ALICE, { name: 'Mai', startDate: '2026-05-01', endDate: '2026-05-02' });
    const res = await call(ALICE, 'GET', '/api/trips');
    const names = res.body.trips.map((t: { name: string }) => t.name);
    expect(names.indexOf('Mai')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('Mai')).toBeLessThan(names.indexOf('Août'));
  });
});

describe('droits par voyage', () => {
  async function setup() {
    const created = await createTrip(ALICE);
    const id = created.trip.id as string;
    await call(ALICE, 'PUT', `/api/trips/${id}/members/${BOB}`, { role: 'editor' });
    await call(ALICE, 'PUT', `/api/trips/${id}/members/${CAROL}`, { role: 'viewer' });
    return id;
  }

  async function version(id: string) {
    return (await call(ALICE, 'GET', `/api/trips/${id}`)).body.trip.version as number;
  }

  const users = [
    { who: 'propriétaire', email: ALICE, read: 200, write: 200, share: 204, remove: 204 },
    { who: 'editor', email: BOB, read: 200, write: 200, share: 403, remove: 403 },
    { who: 'viewer', email: CAROL, read: 200, write: 403, share: 403, remove: 403 },
    { who: 'inconnu', email: MALLORY, read: 404, write: 404, share: 404, remove: 404 },
  ];

  for (const u of users) {
    it(`${u.who} : lire ${u.read}, modifier ${u.write}, partager ${u.share}, supprimer ${u.remove}`, async () => {
      const id = await setup();
      expect((await call(u.email, 'GET', `/api/trips/${id}`)).status).toBe(u.read);

      const v = await version(id);
      const patch = await call(
        u.email,
        'PATCH',
        `/api/trips/${id}`,
        { name: 'Renommé' },
        {
          'if-match': String(v),
        },
      );
      expect(patch.status).toBe(u.write);

      const share = await call(u.email, 'PUT', `/api/trips/${id}/members/dave@example.test`, {
        role: 'viewer',
      });
      expect(share.status).toBe(u.share);

      expect((await call(u.email, 'DELETE', `/api/trips/${id}`)).status).toBe(u.remove);
    });
  }

  it('renvoie le rôle de l’utilisateur avec le voyage', async () => {
    const id = await setup();
    expect((await call(BOB, 'GET', `/api/trips/${id}`)).body.role).toBe('editor');
    expect((await call(CAROL, 'GET', `/api/trips/${id}`)).body.role).toBe('viewer');
  });

  it('un identifiant mal formé répond 404', async () => {
    expect((await call(ALICE, 'GET', '/api/trips/pas-un-uuid')).status).toBe(404);
  });
});

describe('verrou optimiste (If-Match)', () => {
  it('exige la version courante (428 sans If-Match)', async () => {
    const { trip } = await createTrip();
    const res = await call(ALICE, 'PATCH', `/api/trips/${trip.id}`, { name: 'X' });
    expect(res.status).toBe(428);
    expect(res.body.error).toBe('version_required');
  });

  it('refuse une version périmée (409) en renvoyant la version courante', async () => {
    const { trip } = await createTrip();
    const ok = await call(
      ALICE,
      'PATCH',
      `/api/trips/${trip.id}`,
      { name: 'A' },
      {
        'if-match': '1',
      },
    );
    expect(ok.status).toBe(200);
    expect(ok.body.trip.version).toBe(2);

    const stale = await call(
      ALICE,
      'PATCH',
      `/api/trips/${trip.id}`,
      { name: 'B' },
      {
        'if-match': '1',
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: 'version_conflict', version: 2 });
  });
});

describe('PATCH /api/trips/:id : période', () => {
  it('ajoute les jours quand la période s’allonge', async () => {
    const { trip } = await createTrip();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${trip.id}`,
      { startDate: '2026-07-09', endDate: '2026-07-13' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(200);
    expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
    ]);
  });

  it('conserve les jours existants (et leurs notes) quand la période change', async () => {
    const created = await createTrip();
    const day11 = created.days[1];
    await call(
      ALICE,
      'PATCH',
      `/api/trips/${created.trip.id}/days/${day11.id}`,
      { notes: 'Lac' },
      {
        'if-match': '1',
      },
    );
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${created.trip.id}`,
      { startDate: '2026-07-11', endDate: '2026-07-14' },
      { 'if-match': '2' },
    );
    expect(res.status).toBe(200);
    expect(res.body.days[0]).toMatchObject({ id: day11.id, date: '2026-07-11', notes: 'Lac' });
  });

  it('supprime sans confirmation les jours vides retirés', async () => {
    const { trip } = await createTrip();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${trip.id}`,
      { startDate: '2026-07-10', endDate: '2026-07-10' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(1);
  });

  it('refuse de supprimer des jours non vides sans ?force=true (409)', async () => {
    const created = await createTrip();
    const day12 = created.days[2];
    await call(
      ALICE,
      'PATCH',
      `/api/trips/${created.trip.id}/days/${day12.id}`,
      { notes: 'Rando' },
      {
        'if-match': '1',
      },
    );
    const refused = await call(
      ALICE,
      'PATCH',
      `/api/trips/${created.trip.id}`,
      { startDate: '2026-07-10', endDate: '2026-07-11' },
      { 'if-match': '2' },
    );
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: 'days_not_empty', dates: ['2026-07-12'] });

    const forced = await call(
      ALICE,
      'PATCH',
      `/api/trips/${created.trip.id}?force=true`,
      { startDate: '2026-07-10', endDate: '2026-07-11' },
      { 'if-match': '2' },
    );
    expect(forced.status).toBe(200);
    expect(forced.body.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-07-10',
      '2026-07-11',
    ]);
  });
});

describe('PATCH /api/trips/:id : heures de journée', () => {
  it('refuse un début de journée après la fin existante (400)', async () => {
    const { trip } = await createTrip();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${trip.id}`,
      { dayStart: '23:00' },
      {
        'if-match': '1',
      },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid');
  });

  it('accepte une fin de journée cohérente avec le début existant', async () => {
    const { trip } = await createTrip();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${trip.id}`,
      { dayEnd: '23:30' },
      {
        'if-match': '1',
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.trip.dayEnd).toBe('23:30');
  });
});

describe('PATCH /api/trips/:id/days/:dayId', () => {
  it('refuse des heures du jour incohérentes avec celles du voyage (400)', async () => {
    const created = await createTrip();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${created.trip.id}/days/${created.days[0].id}`,
      { dayStart: '22:30' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(400);
  });

  it('modifie les notes et les heures du jour, et incrémente la version', async () => {
    const created = await createTrip();
    const day = created.days[0];
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${created.trip.id}/days/${day.id}`,
      { notes: 'Arrivée', dayStart: '07:00' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(200);
    expect(res.body.trip.version).toBe(2);
    expect(res.body.days[0]).toMatchObject({ notes: 'Arrivée', dayStart: '07:00', dayEnd: null });
  });

  it('répond 404 pour un jour d’un autre voyage', async () => {
    const a = await createTrip(ALICE);
    const b = await createTrip(ALICE);
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${a.trip.id}/days/${b.days[0].id}`,
      {
        notes: 'x',
      },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(404);
  });
});

describe('membres', () => {
  it('normalise l’e-mail et met à jour le rôle d’un membre existant', async () => {
    const { trip } = await createTrip();
    await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/Bob@Example.TEST`, { role: 'viewer' });
    await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/${BOB}`, { role: 'editor' });
    const res = await call(ALICE, 'GET', `/api/trips/${trip.id}`);
    expect(res.body.members).toEqual([{ email: BOB, role: 'editor' }]);
  });

  it('refuse un rôle inconnu, un e-mail invalide, et le propriétaire lui-même (400)', async () => {
    const { trip } = await createTrip();
    expect(
      (await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/${BOB}`, { role: 'owner' })).status,
    ).toBe(400);
    expect(
      (await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/pas-un-email`, { role: 'viewer' }))
        .status,
    ).toBe(400);
    expect(
      (await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/${ALICE}`, { role: 'viewer' }))
        .status,
    ).toBe(400);
  });

  it('accepte des e-mails avec des caractères encodés (+, %) sans erreur serveur', async () => {
    const { trip } = await createTrip();
    const plus = encodeURIComponent('bob+voyage@example.test');
    expect(
      (await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/${plus}`, { role: 'viewer' }))
        .status,
    ).toBe(204);
    const percent = encodeURIComponent('100%bob@example.test');
    const res = await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/${percent}`, {
      role: 'viewer',
    });
    expect(res.status).toBeLessThan(500);
    const members = (await call(ALICE, 'GET', `/api/trips/${trip.id}`)).body.members;
    expect(members.map((m: { email: string }) => m.email)).toContain('bob+voyage@example.test');
  });

  it('retirer un membre lui retire l’accès', async () => {
    const { trip } = await createTrip();
    await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/${BOB}`, { role: 'viewer' });
    expect((await call(BOB, 'GET', `/api/trips/${trip.id}`)).status).toBe(200);
    expect((await call(ALICE, 'DELETE', `/api/trips/${trip.id}/members/${BOB}`)).status).toBe(204);
    expect((await call(BOB, 'GET', `/api/trips/${trip.id}`)).status).toBe(404);
  });
});

describe('DELETE /api/trips/:id', () => {
  it('supprime le voyage, ses jours et ses membres', async () => {
    const { trip } = await createTrip();
    await call(ALICE, 'PUT', `/api/trips/${trip.id}/members/${BOB}`, { role: 'viewer' });
    expect((await call(ALICE, 'DELETE', `/api/trips/${trip.id}`)).status).toBe(204);
    expect((await call(ALICE, 'GET', `/api/trips/${trip.id}`)).status).toBe(404);
    const bobTrips = (await call(BOB, 'GET', '/api/trips')).body.trips as { id: string }[];
    expect(bobTrips.find((t) => t.id === trip.id)).toBeUndefined();
  });
});
