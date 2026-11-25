import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { ALICE, BOB, addMember, call, createTrip } from './helpers';

describe('illustration du voyage', () => {
  it('un nouveau voyage n’a pas d’illustration choisie', async () => {
    const snap = await createTrip();
    expect(snap.trip.illustration).toBeNull();
    expect(snap.trip).not.toHaveProperty('cover');
  });

  it('PATCH enregistre l’illustration, la liste et le voyage la renvoient ; null l’efface', async () => {
    const snap = await createTrip();
    const id = snap.trip.id;
    const set = await call(
      ALICE,
      'PATCH',
      `/api/trips/${id}`,
      { illustration: 'van' },
      { 'if-match': '1' },
    );
    expect(set.status).toBe(200);
    expect(set.body.trip.illustration).toBe('van');
    const list = await call(ALICE, 'GET', '/api/trips');
    expect(list.body.trips.find((t: { id: string }) => t.id === id).illustration).toBe('van');

    const cleared = await call(
      ALICE,
      'PATCH',
      `/api/trips/${id}`,
      { illustration: null },
      { 'if-match': String(set.body.trip.version) },
    );
    expect(cleared.status).toBe(200);
    expect(cleared.body.trip.illustration).toBeNull();
  });

  it('refuse un identifiant inconnu ou une adresse d’image', async () => {
    const snap = await createTrip();
    for (const illustration of ['licorne', 'https://pisteur.example/pixel.jpg']) {
      const res = await call(
        ALICE,
        'PATCH',
        `/api/trips/${snap.trip.id}`,
        { illustration },
        { 'if-match': '1' },
      );
      expect(res.status).toBe(400);
    }
  });

  it('lit comme null une valeur inconnue enregistrée en base', async () => {
    const snap = await createTrip();
    await env.DB.prepare('UPDATE trips SET illustration = ? WHERE id = ?')
      .bind('retiree', snap.trip.id)
      .run();
    const res = await call(ALICE, 'GET', `/api/trips/${snap.trip.id}`);
    expect(res.body.trip.illustration).toBeNull();
  });

  it('un lecteur ne peut pas changer l’illustration', async () => {
    const snap = await createTrip();
    await addMember(snap.trip.id, BOB, 'viewer');
    const res = await call(
      BOB,
      'PATCH',
      `/api/trips/${snap.trip.id}`,
      { illustration: 'plage' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(403);
  });
});

describe('fin des photos Wikimedia Commons', () => {
  it('la recherche de photos n’existe plus', async () => {
    const res = await call(ALICE, 'GET', '/api/covers?q=Alpes');
    expect(res.status).toBe(404);
  });

  it('la colonne cover et le cache des photos ont disparu', async () => {
    const columns = await env.DB.prepare('PRAGMA table_info(trips)').all<{ name: string }>();
    expect(columns.results.map((c) => c.name)).not.toContain('cover');
    const table = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cover_cache'",
    ).first();
    expect(table).toBeNull();
  });
});
