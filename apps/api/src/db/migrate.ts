import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';

// Works both from src/ (tsx) and dist/ (compiled): drizzle/ sits next to them in apps/api.
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export async function runMigrations(db: Database) {
  await migrate(db, { migrationsFolder });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { db, pool } = await import('./client.js');
  await runMigrations(db);
  await pool.end();
  console.log('Migrations applied');
}
