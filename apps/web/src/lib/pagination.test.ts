import { describe, expect, it } from 'vitest';
import { pagerItems } from './pagination';

const show = (current: number, total: number) =>
  pagerItems(current, total)
    .map((item) => (item.type === 'gap' ? '…' : item.page === current ? `[${item.page}]` : item.page))
    .join(' ');

describe('pagerItems', () => {
  it('is empty for a single page', () => {
    expect(pagerItems(1, 0)).toEqual([]);
    expect(pagerItems(1, 1)).toEqual([]);
  });

  it('lists every page when there are few', () => {
    expect(show(1, 5)).toBe('[1] 2 3 4 5');
    expect(show(3, 7)).toBe('1 2 [3] 4 5 6 7');
  });

  it('collapses distant pages into gaps', () => {
    expect(show(1, 20)).toBe('[1] 2 3 … 20');
    expect(show(10, 20)).toBe('1 … 8 9 [10] 11 12 … 20');
    expect(show(20, 20)).toBe('1 … 18 19 [20]');
  });

  it('never hides a single page behind a gap', () => {
    expect(show(5, 20)).toBe('1 2 3 4 [5] 6 7 … 20');
  });

  it('copes with a current page past the end', () => {
    expect(show(9, 3)).toBe('1 2 3');
  });
});
