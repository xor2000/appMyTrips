import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('GET /api/health', () => {
  it('répond 200 avec { ok: true }, sans authentification', async () => {
    const res = await exports.default.fetch('https://mytrips.test/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
