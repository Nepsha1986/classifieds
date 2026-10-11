import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiRequest, toQueryString } from './client';

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('sends cookies and parses the response with the schema', async () => {
    const fetchMock = mockFetch(200, { id: 1, extra: true });
    const result = await apiRequest('/api/thing', z.object({ id: z.number() }));
    expect(result).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/thing');
    expect(init?.credentials).toBe('include');
    expect(init?.method).toBe('GET');
  });

  it('sends plain bodies as JSON', async () => {
    const fetchMock = mockFetch(200, {});
    await apiRequest('/api/thing', null, { method: 'POST', body: { a: 1 } });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends FormData as is, letting the browser set the multipart boundary', async () => {
    const fetchMock = mockFetch(201, []);
    const form = new FormData();
    await apiRequest('/api/thing', z.array(z.never()), { method: 'POST', body: form });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('handles empty responses', async () => {
    mockFetch(204);
    await expect(apiRequest('/api/thing', null, { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('turns API errors into ApiError with details', async () => {
    mockFetch(400, { error: 'Validation failed', details: { fieldErrors: { title: ['Too short'] } } });
    const error = await apiRequest('/api/thing', null).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Validation failed',
      details: { fieldErrors: { title: ['Too short'] } },
    });
  });

  it('reads better-auth error messages', async () => {
    mockFetch(401, { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' });
    await expect(apiRequest('/api/auth/sign-in/email', null)).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
  });

  it('falls back to a generic message for non-JSON errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad gateway', { status: 502 })),
    );
    await expect(apiRequest('/api/thing', null)).rejects.toMatchObject({
      status: 502,
      message: 'Request failed with status 502',
    });
  });
});

describe('toQueryString', () => {
  it('skips unset and empty values', () => {
    expect(toQueryString({ page: 2, status: undefined, q: '' })).toBe('?page=2');
    expect(toQueryString({})).toBe('');
    expect(toQueryString(undefined)).toBe('');
  });
});
