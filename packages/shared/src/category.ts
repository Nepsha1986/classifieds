import { z } from 'zod';

/** A category node. Listings are filed under leaf categories (`children` is empty). */
export type Category = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  children: Category[];
};

/** `GET /api/categories`: the whole tree, top-level categories first, siblings in display order. */
export const categorySchema: z.ZodType<Category> = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullable(),
  slug: z.string(),
  name: z.string(),
  get children() {
    return z.array(categorySchema);
  },
});

export const categoryTreeSchema = z.array(categorySchema);

/** IDs of a category and all of its descendants (e.g. to filter listings by a parent category). */
export function categorySubtreeIds(tree: readonly Category[], id: number): number[] {
  for (const node of tree) {
    if (node.id === id) return collectIds(node);
    const found = categorySubtreeIds(node.children, id);
    if (found.length > 0) return found;
  }
  return [];
}

function collectIds(node: Category): number[] {
  return [node.id, ...node.children.flatMap(collectIds)];
}
