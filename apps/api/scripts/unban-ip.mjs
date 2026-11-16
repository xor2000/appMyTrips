// Commande de secours : réactive une adresse IP bannie.
// pnpm --filter @mytrips/api run unban-ip <ip> [--local]
import { parseArgs, runD1 } from './d1.mjs';
import { unbanIpSql } from './sql.mjs';

const { local, positional } = parseArgs(process.argv.slice(2));
const [ip] = positional;
if (!ip) {
  console.error('Usage : unban-ip <ip> [--local]');
  process.exit(1);
}
runD1(unbanIpSql(ip), { local });
console.log(`Adresse ${ip} réactivée.`);
