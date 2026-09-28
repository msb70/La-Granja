import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { q } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const text = readFileSync(join(here, 'schema.sql'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  const stmts = text.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const s of stmts) await q(s);
  return stmts.length;
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  migrate().then(n => { console.log(`Esquema aplicado (${n} sentencias)`); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
