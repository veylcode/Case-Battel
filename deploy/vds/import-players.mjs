import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const database = new DatabaseSync(process.env.DATABASE_PATH);
const insert = database.prepare('INSERT INTO users (id,name,login,password,state,version,banned,created) VALUES (?,?,?,?,?,?,?,?)');
database.exec('BEGIN IMMEDIATE');
try {
  for (const row of data.users) insert.run(row.id, row.name, row.login ?? null, row.password ?? null, row.state, row.version, row.banned, row.created);
  database.exec('COMMIT');
} catch (error) {
  database.exec('ROLLBACK');
  throw error;
}
console.log('Imported', data.users.length, 'players');
database.close();
