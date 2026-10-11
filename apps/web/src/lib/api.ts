import type { z } from 'zod';
import { serverApiUrl } from '../config';

/** A non-2xx response from the API. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryParams = Record<string, string | number | undefined>;

export type GetOptions = {
  query?: QueryParams;
  /** Seconds Next.js may reuse the response for; omitted = fetched on every request. */
  revalidate?: number;
};

/**
 * Server-side GET against the API, validated with a shared schema (contract drift fails loudly).
 * The public dashboard only reads public data, so no cookies are forwarded.
 */
export async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  { query, revalidate }: GetOptions = {},
): Promise<z.output<T>> {
  const res = await fetch(`${serverApiUrl()}${path}${toQueryString(query)}`, {
    headers: { Accept: 'application/json' },
    ...(revalidate === undefined ? { cache: 'no-store' } : { next: { revalidate } }),
  });
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, data));
  return schema.parse(data);
}

/** Like `apiGet`, but a 404 is `null` (e.g. a listing that was deleted or paused). */
export async function apiGetOrNull<T extends z.ZodType>(
  path: string,
  schema: T,
  options?: GetOptions,
): Promise<z.output<T> | null> {
  try {
    return await apiGet(path, schema, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function toQueryString(query: QueryParams | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function errorMessage(status: number, data: unknown): string {
  if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return `API request failed with status ${status}`;
}
