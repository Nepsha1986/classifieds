import { describe, expect, it } from 'vitest';
import { buildHref, firstParam, parsePage } from './search-params';

describe('firstParam', () => {
  it('reads single and repeated params', () => {
    expect(firstParam({ q: 'bike' }, 'q')).toBe('bike');
    expect(firstParam({ q: ['a', 'b'] }, 'q')).toBe('a');
    expect(firstParam({}, 'q')).toBeUndefined();
  });
});

describe('parsePage', () => {
  it('accepts positive integers', () => {
    expect(parsePage('3')).toBe(3);
  });

  it('falls back to page 1 for anything else', () => {
    for (const value of [undefined, '', '0', '-2', '1.5', 'abc', '1e3', '99999999999999999999']) {
      expect(parsePage(value)).toBe(1);
    }
  });
});

describe('buildHref', () => {
  it('drops empty values and page 1', () => {
    expect(buildHref('/', { page: 1, q: '' })).toBe('/');
    expect(buildHref('/', { q: 'red bike', page: 2 })).toBe('/?q=red+bike&page=2');
  });
});
