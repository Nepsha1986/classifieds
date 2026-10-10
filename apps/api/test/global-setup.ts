import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** Recreates the test database schema from migrations once per test run. */
export default async function setup() {
  const connectionString =
    process.env.TEST_DATABASE_URL ?? 'postgres://classifieds:classifieds@localhost:5432/classifieds_test';
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
}
