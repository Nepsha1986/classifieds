import type { Category } from '@classifieds/shared';
import { describe, expect, it } from 'vitest';
import { categoryPath } from './categories';

const tree: Category[] = [
  {
    id: 1,
    parentId: null,
    slug: 'transport',
    name: 'Transport',
    children: [{ id: 2, parentId: 1, slug: 'cars', name: 'Cars', children: [] }],
  },
];

describe('categoryPath', () => {
  it('returns the chain from the root', () => {
    expect(categoryPath(tree, 2).map((c) => c.slug)).toEqual(['transport', 'cars']);
    expect(categoryPath(tree, 1).map((c) => c.slug)).toEqual(['transport']);
  });

  it('is empty for an unknown id', () => {
    expect(categoryPath(tree, 99)).toEqual([]);
  });
});
