import type { Category } from '@classifieds/shared';
import { asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { categories } from '../db/schema.js';

/** The full category tree. It is small (dozens of rows), so it is read in one query and assembled here. */
export async function getCategoryTree(): Promise<Category[]> {
  const rows = await db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      slug: categories.slug,
      name: categories.name,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));

  const nodes = new Map<number, Category>(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots: Category[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId === null ? undefined : nodes.get(row.parentId);
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}
