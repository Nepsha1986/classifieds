import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, paginatedSchema, paginationQuerySchema } from './pagination.js';

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

describe('paginatedSchema', () => {
  const schema = paginatedSchema(z.object({ id: z.number() }));

  it('accepts a paginated response', () => {
    const page = { items: [{ id: 1 }], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    expect(schema.parse(page)).toEqual(page);
  });

  it('validates the items', () => {
    const page = { items: [{ id: 'x' }], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    expect(schema.safeParse(page).success).toBe(false);
  });
});
