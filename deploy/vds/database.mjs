import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = path.resolve(process.env.DATABASE_PATH ?? 'work/vds-qa.sqlite');
mkdirSync(path.dirname(filename), { recursive: true });
export const sqlite = new DatabaseSync(filename);
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
sqlite.exec('CREATE TABLE IF NOT EXISTS _cb_migrations (name TEXT PRIMARY KEY, applied INTEGER NOT NULL)');
const migrations = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
  if (sqlite.prepare('SELECT 1 FROM _cb_migrations WHERE name=?').get(name)) continue;
  sqlite.exec('BEGIN');
  try {
    sqlite.exec(readFileSync(path.join(migrations, name), 'utf8'));
    sqlite.prepare('INSERT INTO _cb_migrations VALUES (?,?)').run(name, Date.now());
    sqlite.exec('COMMIT');
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
}

function prepare(sql, values = []) {
  const statement = sqlite.prepare(sql);
  return {
    bind: (...next) => prepare(sql, next),
    async first(column) {
      const row = statement.get(...values);
      return column ? row?.[column] ?? null : row ?? null;
    },
    async all() { return { success: true, results: statement.all(...values) }; },
    async run() {
      const result = statement.run(...values);
      return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    },
  };
}
export const env = {
  DB: { prepare },
  ADMIN_LOGIN: process.env.ADMIN_LOGIN,
  ADMIN_HASH: process.env.ADMIN_HASH,
  FRONTEND_ORIGIN: 'https://veylcode.github.io',
};
