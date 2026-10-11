import { listingSchema, paginatedSchema } from '@classifieds/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiGet, apiGetOrNull, toQueryString } from './api';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('apiGet', () => {
  it('calls API_URL with the query and parses the response', async () => {
    vi.stubEnv('API_URL', 'http://api.test:4000/');
    const fetchMock = mockFetch(200, { items: [], page: 2, pageSize: 20, total: 0, totalPages: 0 });

    const page = await apiGet('/api/listings', paginatedSchema(listingSchema), {
      query: { q: 'bike', city: '', page: 2, category: undefined },
    });

    expect(page.page).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test:4000/api/listings?q=bike&page=2',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('asks Next.js to cache when revalidate is given', async () => {
    const fetchMock = mockFetch(200, []);
    await apiGet('/api/categories', z.array(z.unknown()), { revalidate: 300 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/categories',
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
  });

  it('throws ApiError with the server message', async () => {
    mockFetch(400, { error: 'Validation failed' });
    await expect(apiGet('/api/listings', z.unknown())).rejects.toEqual(
      new ApiError(400, 'Validation failed'),
    );
  });

  it('fails loudly when the response does not match the schema', async () => {
    mockFetch(200, { unexpected: true });
    await expect(apiGet('/api/listings', paginatedSchema(listingSchema))).rejects.toThrow();
  });
});

describe('apiGetOrNull', () => {
  it('turns 404 into null', async () => {
    mockFetch(404, { error: 'Listing not found' });
    await expect(apiGetOrNull('/api/listings/x', z.unknown())).resolves.toBeNull();
  });

  it('rethrows other errors', async () => {
    mockFetch(500, {});
    await expect(apiGetOrNull('/api/listings/x', z.unknown())).rejects.toMatchObject({ status: 500 });
  });
});

describe('toQueryString', () => {
  it('skips empty values', () => {
    expect(toQueryString({ a: '', b: undefined })).toBe('');
    expect(toQueryString({ q: 'a b', page: 1 })).toBe('?q=a+b&page=1');
  });
});
