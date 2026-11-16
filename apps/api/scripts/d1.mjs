// Exécute du SQL sur la base D1 avec wrangler (distante par défaut, --local pour la base locale).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
/** Point d'entrée de wrangler, lancé par node sans shell : le SQL passe tel quel en argument. */
const wranglerBin = path.join(
  path.dirname(require.resolve('wrangler/package.json')),
  'bin',
  'wrangler.js',
);

/** Résultats JSON de `wrangler d1 execute` (un élément par requête). */
export function runD1(sql, { local }) {
  if (!existsSync(wranglerBin)) throw new Error(`wrangler introuvable : ${wranglerBin}`);
  const args = ['d1', 'execute', 'DB', local ? '--local' : '--remote', '--json', '--command', sql];
  const output = execFileSync(process.execPath, [wranglerBin, ...args], {
    cwd: path.join(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

export function parseArgs(argv) {
  const local = argv.includes('--local');
  const baseArg = argv.find((a) => a.startsWith('--base='));
  const positional = argv.filter((a) => !a.startsWith('--'));
  return { local, base: baseArg?.slice('--base='.length), positional };
}
