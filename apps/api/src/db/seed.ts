import { fileURLToPath } from 'node:url';
import type { Database } from './client.js';
import { categories } from './schema.js';
import { type CategorySeed, categorySeed } from './seed-data.js';

/** Idempotent: existing categories (by slug) are updated, missing ones inserted. */
export async function seedCategories(db: Database, seed: CategorySeed[] = categorySeed, parentId?: number) {
  for (const [index, item] of seed.entries()) {
    const [row] = await db
      .insert(categories)
      .values({ slug: item.slug, name: item.name, parentId: parentId ?? null, sortOrder: index })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: item.name, parentId: parentId ?? null, sortOrder: index },
      })
      .returning({ id: categories.id });
    if (item.children && row) await seedCategories(db, item.children, row.id);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { db, pool } = await import('./client.js');
  await seedCategories(db);
  await pool.end();
  console.log('Seed complete');
}
