/**
 * Where the API is. Read on every call (not at import time) so one build serves any environment:
 * - `API_URL` — how this Next.js server reaches the API (e.g. `http://api:4000` inside Docker);
 * - `PUBLIC_API_URL` — how a visitor's browser reaches it, used for photo URLs in the rendered HTML.
 *   Defaults to `API_URL`.
 */
export function serverApiUrl(): string {
  return trimSlash(process.env.API_URL || 'http://localhost:4000');
}

export function publicApiUrl(): string {
  return trimSlash(process.env.PUBLIC_API_URL || serverApiUrl());
}

/** Browser URL of an API-relative path such as a photo's `/uploads/listings/...`. */
export function publicAssetUrl(path: string): string {
  return `${publicApiUrl()}${path}`;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
