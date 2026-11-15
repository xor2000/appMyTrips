/** Utilisateur connecté (identité Cloudflare Access), ou null si l'API ne répond pas. */
export async function fetchMe(fetcher: typeof fetch = fetch): Promise<{ email: string } | null> {
  try {
    const res = await fetcher('/api/me', { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'email' in body && typeof body.email === 'string') {
      return { email: body.email };
    }
    return null;
  } catch {
    return null;
  }
}
