/** What Next.js passes as `searchParams`: repeated keys become arrays. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter (a repeated `?page=1&page=2` keeps the first). */
export function firstParam(params: RawSearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** A page number from the URL; anything that is not a positive integer is page 1. */
export function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** `path?query` with empty values dropped and page 1 left out, so URLs stay short and canonical. */
export function buildHref(path: string, query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    if (key === 'page' && Number(value) === 1) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
