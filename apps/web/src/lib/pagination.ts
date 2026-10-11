/** One slot of a pager: a page number or a gap (`…`). */
export type PagerItem = { type: 'page'; page: number } | { type: 'gap'; key: string };

/**
 * Page numbers to show: always the first and last page, plus `radius` pages around the current one,
 * with gaps in between — e.g. `1 … 4 5 [6] 7 8 … 20`. A gap never hides a single page.
 */
export function pagerItems(current: number, totalPages: number, radius = 2): PagerItem[] {
  if (totalPages <= 1) return [];
  const pages = new Set<number>([1, totalPages]);
  for (let p = current - radius; p <= current + radius; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const items: PagerItem[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous === 2) items.push({ type: 'page', page: previous + 1 });
    else if (page - previous > 2) items.push({ type: 'gap', key: `gap-${previous}` });
    items.push({ type: 'page', page });
    previous = page;
  }
  return items;
}
