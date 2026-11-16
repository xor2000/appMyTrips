/** Page de retour après connexion : uniquement un chemin interne (pas de redirection ouverte). */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (next === '/connexion' || next.startsWith('/connexion?') || next.startsWith('/connexion/')) {
    return '/';
  }
  return next;
}

/** URL de la page de connexion, avec la page où revenir ensuite. */
export function loginUrl(next: string): string {
  const target = safeNext(next);
  return target === '/' ? '/connexion' : `/connexion?suite=${encodeURIComponent(target)}`;
}

/** Pages accessibles sans session. */
export function isPublicPath(path: string): boolean {
  return path === '/connexion' || path.startsWith('/reinitialisation/');
}
