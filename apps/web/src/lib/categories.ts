import type { Category } from '@classifieds/shared';

/** The chain from the top-level category down to `id` (empty when unknown). */
export function categoryPath(tree: readonly Category[], id: number): Category[] {
  for (const node of tree) {
    if (node.id === id) return [node];
    const rest = categoryPath(node.children, id);
    if (rest.length > 0) return [node, ...rest];
  }
  return [];
}
