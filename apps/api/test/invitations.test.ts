import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { raw, signup } from './auth-helpers';

const trip = { name: 'Voyage partagé', startDate: '2026-07-10', endDate: '2026-07-12' };

async function ownerWithTrip() {
  const owner = await signup();
  const created = await raw('POST', '/api/trips', { session: owner.session, body: trip });
  return { owner, tripId: created.body.trip.id as string };
}

async function invite(session: string, tripId: string, role = 'viewer') {
  return raw('POST', `/api/trips/${tripId}/invitations`, { session, body: { role } });
}

describe('invitations', () => {
  it('le propriétaire crée un lien ; la personne qui l’accepte devient membre avec ce rôle', async () => {
    const { owner, tripId } = await ownerWithTrip();
    const created = await invite(owner.session, tripId, 'viewer');
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      token: expect.any(String),
      role: 'viewer',
      expiresAt: expect.any(String),
    });
    // Valable 7 jours.
    const days = (Date.parse(created.body.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    const guest = await signup();
    const preview = await raw('GET', `/api/invitations/${created.body.token}`, {
      session: guest.session,
    });
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({
      tripId,
      tripName: 'Voyage partagé',
      ownerEmail: owner.email,
      role: 'viewer',
    });

    const accepted = await raw('POST', `/api/invitations/${created.body.token}/accept`, {
      session: guest.session,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ tripId });
    const seen = await raw('GET', `/api/trips/${tripId}`, { session: guest.session });
    expect(seen.status).toBe(200);
    expect(seen.body.role).toBe('viewer');
  });

  it('seul le propriétaire crée un lien (éditeur 403, inconnu 404) ; rôle owner refusé', async () => {
    const { owner, tripId } = await ownerWithTrip();
    const editor = await signup();
    const link = await invite(owner.session, tripId, 'editor');
    await raw('POST', `/api/invitations/${link.body.token}/accept`, { session: editor.session });
    expect((await invite(editor.session, tripId)).status).toBe(403);
    const stranger = await signup();
    expect((await invite(stranger.session, tripId)).status).toBe(404);
    expect((await invite(owner.session, tripId, 'owner')).status).toBe(400);
  });

  it('lien à usage unique : réutilisé, inconnu ou expiré, il est refusé (404)', async () => {
    const { owner, tripId } = await ownerWithTrip();
    const link = await invite(owner.session, tripId);
    const first = await signup();
    const second = await signup();
    await raw('POST', `/api/invitations/${link.body.token}/accept`, { session: first.session });
    const reused = await raw('POST', `/api/invitations/${link.body.token}/accept`, {
      session: second.session,
    });
    expect(reused.status).toBe(404);
    expect(reused.body.error).toBe('invalid_invitation');
    expect(
      (await raw('GET', `/api/invitations/${link.body.token}`, { session: second.session })).status,
    ).toBe(404);
    expect((await raw('GET', `/api/trips/${tripId}`, { session: second.session })).status).toBe(
      404,
    );

    const unknown = await raw('POST', '/api/invitations/jeton-inconnu/accept', {
      session: second.session,
    });
    expect(unknown.status).toBe(404);

    const expired = await invite(owner.session, tripId);
    await env.DB.prepare(
      "UPDATE invitations SET expires_at = '2000-01-01T00:00:00.000Z' WHERE trip_id = ? AND used_at IS NULL",
    )
      .bind(tripId)
      .run();
    const late = await raw('POST', `/api/invitations/${expired.body.token}/accept`, {
      session: second.session,
    });
    expect(late.status).toBe(404);
  });

  it('le propriétaire ne peut pas accepter son propre lien', async () => {
    const { owner, tripId } = await ownerWithTrip();
    const link = await invite(owner.session, tripId);
    const res = await raw('POST', `/api/invitations/${link.body.token}/accept`, {
      session: owner.session,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('already_owner');
  });

  it('accepter exige une session', async () => {
    const { owner, tripId } = await ownerWithTrip();
    const link = await invite(owner.session, tripId);
    expect((await raw('POST', `/api/invitations/${link.body.token}/accept`)).status).toBe(401);
  });

  it('l’ajout direct d’un membre par e-mail n’existe plus : seul un membre existant change de rôle', async () => {
    const { owner, tripId } = await ownerWithTrip();
    const stranger = await signup();
    const direct = await raw('PUT', `/api/trips/${tripId}/members/${stranger.email}`, {
      session: owner.session,
      body: { role: 'viewer' },
    });
    expect(direct.status).toBe(404);
    expect(direct.body.error).toBe('not_member');
    expect((await raw('GET', `/api/trips/${tripId}`, { session: stranger.session })).status).toBe(
      404,
    );

    const link = await invite(owner.session, tripId, 'viewer');
    await raw('POST', `/api/invitations/${link.body.token}/accept`, { session: stranger.session });
    const promoted = await raw('PUT', `/api/trips/${tripId}/members/${stranger.email}`, {
      session: owner.session,
      body: { role: 'editor' },
    });
    expect(promoted.status).toBe(204);
    const seen = await raw('GET', `/api/trips/${tripId}`, { session: stranger.session });
    expect(seen.body.role).toBe('editor');
  });
});
