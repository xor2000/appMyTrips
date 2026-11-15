import { describe, expect, it, vi } from 'vitest';
import { fetchMe } from './api';

const json = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('fetchMe', () => {
  it('renvoie l’e-mail de l’utilisateur', async () => {
    const fetcher = json(200, { email: 'alice@example.test' });
    expect(await fetchMe(fetcher)).toEqual({ email: 'alice@example.test' });
    expect(fetcher).toHaveBeenCalledWith('/api/me', expect.anything());
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
