import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, paginationQuerySchema } from './pagination.js';

describe('paginationQuerySchema', () => {
  it('applies defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('coerces strings from the query string', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
  });

  it('rejects out-of-range values', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: '1000' }).success).toBe(false);
  });
});
