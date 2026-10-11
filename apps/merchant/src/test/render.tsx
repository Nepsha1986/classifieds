import type { Listing } from '@classifieds/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { createQueryClient } from '../query-client';
import { routes } from '../routes';

export type MockResponse = { status?: number; body?: unknown };
export type MockHandler = (request: {
  url: URL;
  init: RequestInit | undefined;
  body: unknown;
}) => MockResponse;

/**
 * Replaces `fetch` with a fake API. Keys are `"METHOD /path"` (no query string); unmatched requests get a
 * 404 so a missing handler fails loudly. Returns the mock to inspect calls.
 */
export function mockApi(handlers: Record<string, MockHandler | MockResponse>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    const handler = handlers[key];
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    const response = typeof handler === 'function' ? handler({ url, init, body }) : handler;
    if (!response) return new Response(JSON.stringify({ error: `No mock for ${key}` }), { status: 404 });
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Calls made to `"METHOD /path"`, with parsed JSON bodies. */
export function callsTo(fetchMock: ReturnType<typeof mockApi>, key: string) {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        `${init?.method ?? 'GET'} ${new URL(String(input), 'http://localhost').pathname}` === key,
    )
    .map(([input, init]) => ({
      url: new URL(String(input), 'http://localhost'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    }));
}

export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

export const profile = {
  id: '9ee39a69-14c3-4476-a2c6-e92ac5742588',
  name: 'Olena Kovalenko',
  email: 'olena@demo.classifieds',
  emailVerified: false,
  image: null,
  phone: '+380501112233',
  city: 'Kyiv',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

export const unauthorized: MockResponse = { status: 401, body: { error: 'Authentication required' } };

export const categoryTree = [
  {
    id: 1,
    parentId: null,
    slug: 'transport',
    name: 'Transport',
    children: [{ id: 2, parentId: 1, slug: 'cars', name: 'Cars', children: [] }],
  },
  {
    id: 4,
    parentId: null,
    slug: 'electronics',
    name: 'Electronics',
    children: [{ id: 5, parentId: 4, slug: 'phones', name: 'Phones', children: [] }],
  },
];

let listingCounter = 0;

/** A listing as the API returns it; IDs are unique per call. */
export function makeListing(overrides: Partial<Listing> = {}): Listing {
  listingCounter += 1;
  const n = String(listingCounter).padStart(12, '0');
  return {
    id: `00000000-0000-4000-8000-${n}`,
    sellerId: profile.id,
    categoryId: 5,
    title: `Listing ${listingCounter}`,
    description: 'A thing for sale',
    price: 1_000_000,
    currency: 'UAH',
    city: 'Kyiv',
    status: 'active',
    attributes: {},
    photos: [],
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    ...overrides,
  };
}

export function page<T>(items: T[], { page = 1, pageSize = 20, total = items.length } = {}) {
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/** Responses every signed-in page needs. */
export const signedInHandlers = {
  'GET /api/me': { body: profile },
  'GET /api/categories': { body: categoryTree },
  'GET /api/me/listings': { body: page([]) },
} satisfies Record<string, MockResponse>;
