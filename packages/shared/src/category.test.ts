import { describe, expect, it } from 'vitest';
import { type Category, categorySubtreeIds, categoryTreeSchema } from './category.js';

const tree: Category[] = [
  {
    id: 1,
    parentId: null,
    slug: 'transport',
    name: 'Transport',
    children: [
      { id: 2, parentId: 1, slug: 'cars', name: 'Cars', children: [] },
      { id: 3, parentId: 1, slug: 'bikes', name: 'Bikes', children: [] },
    ],
  },
  { id: 4, parentId: null, slug: 'other', name: 'Other', children: [] },
];

describe('categoryTreeSchema', () => {
  it('parses a nested tree', () => {
    expect(categoryTreeSchema.parse(tree)).toEqual(tree);
  });

  it('rejects a node without children', () => {
    const bad = [{ id: 1, parentId: null, slug: 'x', name: 'X' }];
    expect(categoryTreeSchema.safeParse(bad).success).toBe(false);
  });

  it('validates nested nodes too', () => {
    const bad = [{ ...tree[0], children: [{ id: 'two' }] }];
    expect(categoryTreeSchema.safeParse(bad).success).toBe(false);
  });
});

describe('categorySubtreeIds', () => {
  it('returns a parent with all of its descendants', () => {
    expect(categorySubtreeIds(tree, 1)).toEqual([1, 2, 3]);
  });

  it('returns just the leaf for a leaf', () => {
    expect(categorySubtreeIds(tree, 3)).toEqual([3]);
  });

  it('returns nothing for an unknown id', () => {
    expect(categorySubtreeIds(tree, 99)).toEqual([]);
  });
});
