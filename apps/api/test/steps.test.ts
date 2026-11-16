import { describe, expect, it } from 'vitest';
import { ALICE, BOB, CAROL, MALLORY, addStep, call, createTrip, addMember } from './helpers';

const LOUVRE = { type: 'museum', name: 'Musée du Louvre', lat: 48.8606, lng: 2.3376 };
const ORSAY = { type: 'museum', name: 'Musée d’Orsay', lat: 48.86, lng: 2.3266 };

type Snap = { trip: { version: number }; steps: any[]; days: { id: string; date: string }[] };
const byName = (snap: Snap, name: string) => snap.steps.find((s) => s.name === name);

describe('POST /api/trips/:id/steps', () => {
  it('ajoute une étape au jour, avec durée par défaut, fuseau horaire et position', async () => {
    const t = await createTrip();
    const snap = await addStep(t.trip.id, 1, { ...LOUVRE, dayId: t.days[0].id });
    expect(snap.trip.version).toBe(2);
    expect(snap.steps).toHaveLength(1);
    expect(snap.steps[0]).toMatchObject({
      name: 'Musée du Louvre',
      kind: 'step',
      type: 'museum',
      dayId: t.days[0].id,
      parentId: null,
      durationMin: 120,
      timezone: 'Europe/Paris',
      fixedStart: null,
    });
    expect(snap.steps[0].position).toBeTypeOf('string');
  });

  it('ajoute en fin de liste quand aucune position n’est donnée', async () => {
    const t = await createTrip();
    await addStep(t.trip.id, 1, { ...LOUVRE, dayId: t.days[0].id });
    const snap = await addStep(t.trip.id, 2, { ...ORSAY, dayId: t.days[0].id });
    expect(byName(snap, 'Musée du Louvre').position < byName(snap, 'Musée d’Orsay').position).toBe(
      true,
    );
  });

  it('ajoute une idée (sans jour)', async () => {
    const t = await createTrip();
    const snap = await addStep(t.trip.id, 1, { ...LOUVRE, dayId: null });
    expect(snap.steps[0].dayId).toBeNull();
  });

  it('exige If-Match (428) et refuse une version périmée (409)', async () => {
    const t = await createTrip();
    const path = `/api/trips/${t.trip.id}/steps`;
    expect((await call(ALICE, 'POST', path, { ...LOUVRE, dayId: null })).status).toBe(428);
    expect(
      (await call(ALICE, 'POST', path, { ...LOUVRE, dayId: null }, { 'if-match': '7' })).status,
    ).toBe(409);
  });

  it('refuse un jour d’un autre voyage (400)', async () => {
    const t = await createTrip();
    const other = await createTrip();
    const res = await call(
      ALICE,
      'POST',
      `/api/trips/${t.trip.id}/steps`,
      { ...LOUVRE, dayId: other.days[0].id },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_day');
  });

  it('applique les droits : editor oui, viewer 403, inconnu 404', async () => {
    const t = await createTrip();
    await addMember(t.trip.id, BOB, 'editor');
    await addMember(t.trip.id, CAROL, 'viewer');
    const path = `/api/trips/${t.trip.id}/steps`;
    const body = { ...LOUVRE, dayId: null };
    expect((await call(BOB, 'POST', path, body, { 'if-match': '1' })).status).toBe(201);
    expect((await call(CAROL, 'POST', path, body, { 'if-match': '2' })).status).toBe(403);
    expect((await call(MALLORY, 'POST', path, body, { 'if-match': '2' })).status).toBe(404);
  });
});

describe('dossiers', () => {
  async function withGroup() {
    const t = await createTrip();
    const day = t.days[0].id;
    const created = await addStep(t.trip.id, 1, { kind: 'group', name: 'Vieux-Port', dayId: day });
    const group = byName(created, 'Vieux-Port');
    await addStep(t.trip.id, 2, { ...LOUVRE, dayId: day, parentId: group.id });
    const snap = await addStep(t.trip.id, 3, { ...ORSAY, dayId: day, parentId: group.id });
    return { t, day, group, snap };
  }

  it('crée un dossier puis y range des étapes', async () => {
    const { group, snap } = await withGroup();
    expect(group).toMatchObject({ kind: 'group', type: null, lat: null, lng: null });
    expect(snap.steps.filter((s: any) => s.parentId === group.id)).toHaveLength(2);
  });

  it('refuse un parent qui n’est pas un dossier, un dossier imbriqué ou un autre jour (400)', async () => {
    const { t, day, group, snap } = await withGroup();
    const louvre = byName(snap, 'Musée du Louvre');
    const path = `/api/trips/${t.trip.id}/steps`;
    const v = { 'if-match': String(snap.trip.version) };
    const notAGroup = await call(
      ALICE,
      'POST',
      path,
      { ...ORSAY, dayId: day, parentId: louvre.id },
      v,
    );
    expect(notAGroup.status).toBe(400);
    const nested = await call(
      ALICE,
      'POST',
      path,
      { kind: 'group', name: 'Sous-dossier', dayId: day, parentId: group.id },
      v,
    );
    expect(nested.status).toBe(400);
    const otherDay = await call(
      ALICE,
      'POST',
      path,
      { ...ORSAY, dayId: t.days[1].id, parentId: group.id },
      v,
    );
    expect(otherDay.status).toBe(400);
    expect(otherDay.body.error).toBe('invalid_parent');
  });

  it('déplacer un dossier vers un autre jour emporte ses étapes', async () => {
    const { t, group, snap } = await withGroup();
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}/steps/${group.id}`,
      { dayId: t.days[2].id },
      { 'if-match': String(snap.trip.version) },
    );
    expect(res.status).toBe(200);
    const moved = res.body.steps.filter((s: any) => s.id === group.id || s.parentId === group.id);
    expect(moved.every((s: any) => s.dayId === t.days[2].id)).toBe(true);
  });

  it('supprimer un dossier exige de choisir le sort de ses étapes (400 sinon)', async () => {
    const { t, group, snap } = await withGroup();
    const res = await call(
      ALICE,
      'DELETE',
      `/api/trips/${t.trip.id}/steps/${group.id}`,
      undefined,
      {
        'if-match': String(snap.trip.version),
      },
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('children_mode_required');
  });

  it('supprimer un dossier en gardant ses étapes les remonte à sa place, dans l’ordre', async () => {
    const t = await createTrip();
    const day = t.days[0].id;
    await addStep(t.trip.id, 1, { ...LOUVRE, name: 'Avant', dayId: day });
    const withGroup = await addStep(t.trip.id, 2, { kind: 'group', name: 'Dossier', dayId: day });
    const group = byName(withGroup, 'Dossier');
    await addStep(t.trip.id, 3, { ...LOUVRE, name: 'Après', dayId: day });
    await addStep(t.trip.id, 4, {
      ...LOUVRE,
      name: 'Enfant 1',
      dayId: day,
      parentId: group.id,
    });
    const snap = await addStep(t.trip.id, 5, {
      ...LOUVRE,
      name: 'Enfant 2',
      dayId: day,
      parentId: group.id,
    });

    const res = await call(
      ALICE,
      'DELETE',
      `/api/trips/${t.trip.id}/steps/${group.id}?children=keep`,
      undefined,
      { 'if-match': String(snap.trip.version) },
    );
    expect(res.status).toBe(200);
    const order = [...res.body.steps]
      .filter((s: any) => s.dayId === day)
      .sort((a: any, b: any) => (a.position < b.position ? -1 : 1))
      .map((s: any) => [s.name, s.parentId]);
    expect(order).toEqual([
      ['Avant', null],
      ['Enfant 1', null],
      ['Enfant 2', null],
      ['Après', null],
    ]);
  });

  it('supprimer un dossier avec ses étapes les supprime toutes', async () => {
    const { t, group, snap } = await withGroup();
    const res = await call(
      ALICE,
      'DELETE',
      `/api/trips/${t.trip.id}/steps/${group.id}?children=delete`,
      undefined,
      { 'if-match': String(snap.trip.version) },
    );
    expect(res.status).toBe(200);
    expect(res.body.steps).toEqual([]);
  });
});

describe('PATCH /api/trips/:id/steps/:stepId', () => {
  it('modifie les champs d’une étape', async () => {
    const t = await createTrip();
    const snap = await addStep(t.trip.id, 1, { ...LOUVRE, dayId: t.days[0].id });
    const id = snap.steps[0].id;
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}/steps/${id}`,
      { durationMin: 150, fixedStart: '10:30', notes: 'Billets coupe-file', bookingRef: 'AB12' },
      { 'if-match': '2' },
    );
    expect(res.status).toBe(200);
    expect(res.body.steps[0]).toMatchObject({
      durationMin: 150,
      fixedStart: '10:30',
      notes: 'Billets coupe-file',
      bookingRef: 'AB12',
    });
  });

  it('recalcule le fuseau horaire quand le point change', async () => {
    const t = await createTrip();
    const snap = await addStep(t.trip.id, 1, { ...LOUVRE, dayId: t.days[0].id });
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}/steps/${snap.steps[0].id}`,
      { lat: 40.7794, lng: -73.9632 },
      { 'if-match': '2' },
    );
    expect(res.body.steps[0].timezone).toBe('America/New_York');
  });

  it('déplace une étape vers un autre jour, puis vers les idées', async () => {
    const t = await createTrip();
    const snap = await addStep(t.trip.id, 1, { ...LOUVRE, dayId: t.days[0].id });
    const id = snap.steps[0].id;
    const path = `/api/trips/${t.trip.id}/steps/${id}`;
    const toDay = await call(
      ALICE,
      'PATCH',
      path,
      { dayId: t.days[1].id, position: 'a5' },
      {
        'if-match': '2',
      },
    );
    expect(toDay.body.steps[0]).toMatchObject({ dayId: t.days[1].id, position: 'a5' });
    const toIdeas = await call(ALICE, 'PATCH', path, { dayId: null }, { 'if-match': '3' });
    expect(toIdeas.body.steps[0].dayId).toBeNull();
  });

  it('sortir une étape d’un dossier en la changeant de jour la détache du dossier', async () => {
    const t = await createTrip();
    let snap = await addStep(t.trip.id, 1, { kind: 'group', name: 'G', dayId: t.days[0].id });
    const g = byName(snap, 'G');
    snap = await addStep(t.trip.id, 2, { ...LOUVRE, dayId: t.days[0].id, parentId: g.id });
    const child = byName(snap, 'Musée du Louvre');
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}/steps/${child.id}`,
      { dayId: t.days[1].id },
      { 'if-match': '3' },
    );
    expect(res.status).toBe(200);
    expect(byName(res.body, 'Musée du Louvre')).toMatchObject({
      dayId: t.days[1].id,
      parentId: null,
    });
  });

  it('répond 404 pour une étape d’un autre voyage', async () => {
    const a = await createTrip();
    const b = await createTrip();
    const snap = await addStep(b.trip.id, 1, { ...LOUVRE, dayId: null });
    const res = await call(
      ALICE,
      'PATCH',
      `/api/trips/${a.trip.id}/steps/${snap.steps[0].id}`,
      { name: 'X' },
      { 'if-match': '1' },
    );
    expect(res.status).toBe(404);
  });

  it('supprime une étape', async () => {
    const t = await createTrip();
    const snap = await addStep(t.trip.id, 1, { ...LOUVRE, dayId: null });
    const res = await call(
      ALICE,
      'DELETE',
      `/api/trips/${t.trip.id}/steps/${snap.steps[0].id}`,
      undefined,
      {
        'if-match': '2',
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.steps).toEqual([]);
  });
});

describe('période du voyage et étapes', () => {
  it('un jour avec des étapes n’est pas vide : 409, puis ?force=true envoie ses étapes dans les idées', async () => {
    const t = await createTrip();
    const snap = await addStep(t.trip.id, 1, { ...LOUVRE, dayId: t.days[2].id });
    const refused = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}`,
      { startDate: '2026-07-10', endDate: '2026-07-11' },
      { 'if-match': '2' },
    );
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: 'days_not_empty', dates: ['2026-07-12'] });

    const forced = await call(
      ALICE,
      'PATCH',
      `/api/trips/${t.trip.id}?force=true`,
      { startDate: '2026-07-10', endDate: '2026-07-11' },
      { 'if-match': '2' },
    );
    expect(forced.status).toBe(200);
    expect(forced.body.steps).toHaveLength(1);
    expect(forced.body.steps[0]).toMatchObject({ id: snap.steps[0].id, dayId: null });
  });

  it('supprimer le voyage supprime ses étapes et séjours', async () => {
    const t = await createTrip();
    await addStep(t.trip.id, 1, { ...LOUVRE, dayId: null });
    expect((await call(ALICE, 'DELETE', `/api/trips/${t.trip.id}`)).status).toBe(204);
    expect((await call(ALICE, 'GET', `/api/trips/${t.trip.id}`)).status).toBe(404);
  });
});
