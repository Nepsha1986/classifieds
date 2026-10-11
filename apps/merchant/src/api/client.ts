import type { z } from 'zod';

/**
 * Base URL of the API. Empty (the default) means the app's own origin: the Vite dev server proxies
 * `/api` and `/uploads` to the API. Set `VITE_API_URL` when the API lives on another origin (CORS).
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Absolute URL for an API path, e.g. a photo's `/uploads/...` URL. */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

/** A non-2xx response. `message` is the server's error text; `details` holds validation issues. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryParams = Record<string, string | number | undefined>;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Plain values are sent as JSON; `FormData` as multipart. */
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
};

/**
 * Calls the API with the session cookie and validates the JSON response with a shared schema
 * (`null` for responses without a body, e.g. 204).
 */
export async function apiRequest<T extends z.ZodType | null>(
  path: string,
  schema: T,
  { method = 'GET', body, query, signal }: RequestOptions = {},
): Promise<T extends z.ZodType ? z.output<T> : void> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(apiUrl(path + toQueryString(query)), {
    method,
    headers,
    body: payload,
    credentials: 'include',
    signal,
  });

  const data: unknown = await readJson(res);
  if (!res.ok) throw toApiError(res.status, data);
  return (schema === null ? undefined : schema.parse(data)) as T extends z.ZodType ? z.output<T> : void;
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

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Our API answers `{ error, details }`; better-auth answers `{ message, code }`. */
function toApiError(status: number, data: unknown): ApiError {
  const body = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const message =
    typeof body.error === 'string'
      ? body.error
      : typeof body.message === 'string'
        ? body.message
        : `Request failed with status ${status}`;
  return new ApiError(status, message, body.details);
}
