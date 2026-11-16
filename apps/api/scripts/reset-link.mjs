// Commande de secours : lien de réinitialisation du mot de passe (24 h, usage unique).
// pnpm --filter @mytrips/api run reset-link <email> [--local] [--base=https://…]
import { randomBytes } from 'node:crypto';
import { parseArgs, runD1 } from './d1.mjs';
import { resetLinkSql } from './sql.mjs';

const { local, base, positional } = parseArgs(process.argv.slice(2));
const [email] = positional;
if (!email) {
  console.error('Usage : reset-link <email> [--local] [--base=https://…]');
  process.exit(1);
}
const token = randomBytes(32).toString('base64url');
const results = runD1(await resetLinkSql(email, token, new Date()), { local });
// RETURNING : une ligne si le compte existe (le lien a été créé), aucune sinon.
if ((results[0]?.results?.length ?? 0) !== 1) {
  console.error(`Aucun compte pour ${email} (rien n'a été créé).`);
  process.exit(1);
}
const origin =
  base ?? (local ? 'http://localhost:8787' : 'https://mytrips.dev-workshop-net.workers.dev');
console.log(`Lien de réinitialisation (24 h, usage unique) :\n${origin}/reinitialisation/${token}`);
