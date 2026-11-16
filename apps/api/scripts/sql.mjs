// SQL des commandes de secours (reset-link, unban-ip), sans dépendance à Node : testé dans le
// runtime Workers (test/admin.test.ts). Chaque requête tient sur une ligne (D1 exec).

// Ni guillemet, ni barre oblique inverse, ni point-virgule : la valeur est insérée dans le SQL.
const EMAIL = /^[^\s@'"\\;]+@[^\s@'"\\;]+\.[^\s@'"\\;]+$/;
const IP = /^[0-9a-fA-F:.]{2,45}$/;
/** Durée de validité d'un lien de réinitialisation (comme /api/admin/resets). */
const RESET_TTL_MS = 24 * 60 * 60 * 1000;

async function sha256Hex(text) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Insère un lien de réinitialisation pour `email` (jeton `token`, stocké haché). */
export async function resetLinkSql(email, token, now) {
  const normalized = String(email).trim().toLowerCase();
  if (!EMAIL.test(normalized)) throw new Error(`E-mail invalide : ${email}`);
  if (!/^[\w-]+$/.test(token)) throw new Error('Jeton invalide');
  const hash = await sha256Hex(token);
  const created = now.toISOString();
  const expires = new Date(now.getTime() + RESET_TTL_MS).toISOString();
  return (
    'INSERT INTO password_resets (token_hash, email, created_by, created_at, expires_at) ' +
    `SELECT '${hash}', email, 'commande de secours', '${created}', '${expires}' ` +
    `FROM users WHERE email = '${normalized}' RETURNING email;`
  );
}

/** Réactive une IP bannie et vide son compteur d'échecs. */
export function unbanIpSql(ip) {
  if (!IP.test(ip)) throw new Error(`Adresse IP invalide : ${ip}`);
  return [
    `DELETE FROM ip_bans WHERE ip = '${ip}';`,
    `DELETE FROM auth_attempts WHERE kind = 'login_failure' AND ip = '${ip}';`,
  ].join('\n');
}
