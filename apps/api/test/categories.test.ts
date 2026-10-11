import { type Category, categoryTreeSchema } from '@classifieds/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { categorySeed } from '../src/db/seed-data.js';
import { seededCategories } from './helpers.js';

const app = createApp();

beforeAll(async () => {
  await seededCategories();
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/categories', () => {
  it('returns the seeded tree in seed order, without auth', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=');

    const tree = categoryTreeSchema.parse(res.body);
    const shape = (nodes: Category[]): unknown =>
      nodes.map((n) => ({ slug: n.slug, children: shape(n.children) }));
    const seedShape = (nodes: typeof categorySeed): unknown =>
      nodes.map((n) => ({ slug: n.slug, children: seedShape(n.children ?? []) }));
    expect(shape(tree)).toEqual(seedShape(categorySeed));
  });

  it('links children to their parent', async () => {
    const tree = categoryTreeSchema.parse((await request(app).get('/api/categories')).body);
    for (const root of tree) {
      expect(root.parentId).toBeNull();
      for (const child of root.children) expect(child.parentId).toBe(root.id);
    }
    const transport = tree.find((c) => c.slug === 'transport')!;
    expect(transport.children.map((c) => c.slug)).toEqual(['cars', 'motorcycles', 'auto-parts']);
  });
});
