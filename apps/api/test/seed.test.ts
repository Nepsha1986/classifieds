import { count, isNotNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db, pool } from '../src/db/client.js';
import { categories } from '../src/db/schema.js';
import { seedCategories } from '../src/db/seed.js';
import { categorySeed } from '../src/db/seed-data.js';

afterAll(async () => {
  await pool.end();
});

const expectedTotal = categorySeed.reduce((sum, c) => sum + 1 + (c.children?.length ?? 0), 0);

describe('seedCategories', () => {
  it('creates the category tree and is idempotent', async () => {
    await seedCategories(db);
    await seedCategories(db);

    const [all] = await db.select({ n: count() }).from(categories);
    const [children] = await db.select({ n: count() }).from(categories).where(isNotNull(categories.parentId));
    expect(all?.n).toBe(expectedTotal);
    expect(children?.n).toBe(expectedTotal - categorySeed.length);
  });
});
