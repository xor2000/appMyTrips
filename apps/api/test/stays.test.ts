import { describe, expect, it } from 'vitest';
import { ALICE, CAROL, call, createTrip } from './helpers';

const CHALET = {
  name: 'Chalet de Cotagne',
  lat: 45.88,
  lng: 6.31,
  checkInDate: '2026-07-10',
  checkOutDate: '2026-07-12',
};

describe('séjours', () => {
  it('ajoute un séjour avec ses heures par défaut et incrémente la version', async () => {
    const t = await createTrip();
    const res = await call(ALICE, 'POST', `/api/trips/${t.trip.id}/stays`, CHALET, {
      'if-match': '1',
    });
    expect(res.status).toBe(201);
    expect(res.body.trip.version).toBe(2);
    expect(res.body.stays[0]).toMatchObject({
      ...CHALET,
      checkInTime: '17:00',
      checkOutTime: '10:00',
    });
  });

  it('refuse un séjour sans nuit (400)', async () => {
    const t = await createTrip();
    const res = await call(
      ALICE,
      'POST',
      `/api/trips/${t.trip.id}/stays`,
      { ...CHALET, checkOutDate: '2026-07-10' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(400);
  });

  it('modifie puis supprime un séjour', async () => {
    const t = await createTrip();
    const created = await call(ALICE, 'POST', `/api/trips/${t.trip.id}/stays`, CHALET, {
      'if-match': '1',
    });
    const id = created.body.stays[0].id;
    const patched = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}/stays/${id}`,
      { checkInTime: '15:00', bookingRef: 'BK-42' },
      { 'if-match': '2' },
    );
    expect(patched.body.stays[0]).toMatchObject({ checkInTime: '15:00', bookingRef: 'BK-42' });
    const deleted = await call(ALICE, 'DELETE', `/api/trips/${t.trip.id}/stays/${id}`, undefined, {
      'if-match': '3',
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body.stays).toEqual([]);
  });

  it('un lecteur ne peut pas ajouter de séjour (403)', async () => {
    const t = await createTrip();
    await call(ALICE, 'PUT', `/api/trips/${t.trip.id}/members/${CAROL}`, { role: 'viewer' });
    const res = await call(CAROL, 'POST', `/api/trips/${t.trip.id}/stays`, CHALET, {
      'if-match': '1',
    });
    expect(res.status).toBe(403);
  });

  it('répond 404 pour un séjour d’un autre voyage', async () => {
    const a = await createTrip();
    const b = await createTrip();
    const created = await call(ALICE, 'POST', `/api/trips/${b.trip.id}/stays`, CHALET, {
      'if-match': '1',
    });
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${a.trip.id}/stays/${created.body.stays[0].id}`,
      { name: 'X' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(404);
  });
});
