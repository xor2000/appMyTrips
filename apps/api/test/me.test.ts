import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('routes protégées (application complète)', () => {
  it('GET /api/me sans session répond 401', async () => {
    const res = await exports.default.fetch('https://mytrips.test/api/me');
    expect(res.status).toBe(401);
  });

  it('une route API inconnue sans session répond 401 (pas de fuite de routes)', async () => {
    const res = await exports.default.fetch('https://mytrips.test/api/inconnue');
    expect(res.status).toBe(401);
  });
});
