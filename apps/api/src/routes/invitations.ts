import { InvitationCreate } from '@mytrips/core';
import { Hono, type Context } from 'hono';
import { randomToken, sha256Hex } from '../auth/crypto';
import type { AuthEnv } from '../auth/session';
import { access, now, parseBody, type TripsEnv } from './shared';

/** Durée de validité d'un lien d'invitation. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** POST /api/trips/:id/invitations : le propriétaire crée un lien (rôle lecture ou modification). */
export function registerInvitationRoutes(trips: Hono<TripsEnv>) {
  trips.post('/:id/invitations', access('owner'), async (c) => {
    const body = await parseBody(c, InvitationCreate);
    if ('error' in body) return body.error;
    const token = randomToken();
    const ts = now();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
    await c.env.DB.prepare(
      `INSERT INTO invitations (token_hash, trip_id, role, created_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        await sha256Hex(token),
        c.req.param('id'),
        body.data.role,
        c.get('userEmail'),
        ts,
        expiresAt,
      )
      .run();
    return c.json({ token, role: body.data.role, expiresAt }, 201);
  });
}

interface InvitationRow {
  trip_id: string;
  role: 'viewer' | 'editor';
  name: string;
  owner_email: string;
}

/** Invitation encore valable (ni utilisée ni expirée), avec son voyage. */
async function findInvitation(c: Context<AuthEnv>, tokenHash: string) {
  return c.env.DB.prepare(
    `SELECT i.trip_id, i.role, t.name, t.owner_email
     FROM invitations i JOIN trips t ON t.id = i.trip_id
     WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ?`,
  )
    .bind(tokenHash, now())
    .first<InvitationRow>();
}

const invalid = (c: Context) => c.json({ error: 'invalid_invitation' }, 404);

/** /api/invitations/:token : aperçu et acceptation (session exigée). */
export const invitationRoutes = new Hono<AuthEnv>();

invitationRoutes.get('/:token', async (c) => {
  const inv = await findInvitation(c, await sha256Hex(c.req.param('token')));
  if (!inv) return invalid(c);
  return c.json({
    tripId: inv.trip_id,
    tripName: inv.name,
    ownerEmail: inv.owner_email,
    role: inv.role,
  });
});

invitationRoutes.post('/:token/accept', async (c) => {
  const db = c.env.DB;
  const email = c.get('userEmail');
  const tokenHash = await sha256Hex(c.req.param('token'));
  const inv = await findInvitation(c, tokenHash);
  if (!inv) return invalid(c);
  if (inv.owner_email === email) return c.json({ error: 'already_owner' }, 400);
  const ts = now();
  // Le lien est consommé et le membre ajouté dans une seule transaction ; l'ajout est conditionné
  // à la consommation par cette requête (deux acceptations simultanées : une seule passe).
  const [used] = await db.batch([
    db
      .prepare(
        `UPDATE invitations SET used_at = ?, used_by = ?
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
      )
      .bind(ts, email, tokenHash, ts),
    db
      .prepare(
        `INSERT INTO trip_members (trip_id, email, role, created_at)
         SELECT ?, ?, ?, ?
         WHERE (SELECT used_by FROM invitations WHERE token_hash = ? AND used_at = ?) = ?
         ON CONFLICT (trip_id, email) DO UPDATE SET role = excluded.role`,
      )
      .bind(inv.trip_id, email, inv.role, ts, tokenHash, ts, email),
  ]);
  if ((used?.meta.changes ?? 0) !== 1) return invalid(c);
  return c.json({ tripId: inv.trip_id });
});
