import {
  currencyDigits,
  DEFAULT_CURRENCY,
  LISTING_SEARCH_QUERY_MAX,
  LISTING_SORTS,
  type Category,
  type ListingSearchQuery,
  type ListingSort,
} from '@classifieds/shared';
import { firstParam, parsePage, type RawSearchParams } from './search-params';

/**
 * Search state as it appears in the dashboard's URL. Unlike the API query it is meant for people:
 * the category is a slug and prices are in major units (`minPrice=1500` is UAH 1,500).
 */
export type Filters = {
  q?: string;
  category?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  currency?: string;
  sort?: ListingSort;
  page: number;
};

/** URL parameters in canonical order. */
export const FILTER_KEYS = ['q', 'category', 'city', 'minPrice', 'maxPrice', 'currency', 'sort'] as const;

export type ParsedFilters = {
  /** Valid values only, defaults left out — what the form shows and the canonical URL carries. */
  filters: Filters;
  /** The same search in API terms (category ID, prices in minor units). */
  apiQuery: Partial<ListingSearchQuery>;
  /** The sort actually applied (the default when none is chosen). */
  effectiveSort: ListingSort;
  /** The currency price bounds are compared in, when a bound is set. */
  priceCurrency?: string;
};

const MAX_PRICE_MINOR = 2_000_000_000;

/**
 * Reads the URL into filters. Invalid values are dropped rather than rejected: a stale or hand-edited
 * link should still show listings, and the page then redirects to the cleaned, canonical URL.
 */
export function parseFilters(raw: RawSearchParams, categories: readonly Category[]): ParsedFilters {
  const get = (key: string) => firstParam(raw, key)?.trim() || undefined;
  const filters: Filters = { page: parsePage(get('page')) };
  const apiQuery: Partial<ListingSearchQuery> = {};

  const q = get('q')?.slice(0, LISTING_SEARCH_QUERY_MAX).trim();
  if (q) filters.q = apiQuery.q = q;

  const slug = get('category');
  const category = slug ? findBySlug(categories, slug) : undefined;
  if (category) {
    filters.category = category.slug;
    apiQuery.category = category.id;
  }

  const city = get('city');
  if (city && city.length <= 100) filters.city = apiQuery.city = city;

  const currency = get('currency')?.toUpperCase();
  if (currency && /^[A-Z]{3}$/.test(currency)) filters.currency = currency;

  // Price bounds are compared within one currency (DECISIONS D20); without a choice it is the default.
  const priceCurrency = filters.currency ?? DEFAULT_CURRENCY;
  let min = parseMajorAmount(get('minPrice'), priceCurrency);
  let max = parseMajorAmount(get('maxPrice'), priceCurrency);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  if (min !== undefined) {
    apiQuery.minPrice = min;
    filters.minPrice = formatMajorAmount(min, priceCurrency);
  }
  if (max !== undefined) {
    apiQuery.maxPrice = max;
    filters.maxPrice = formatMajorAmount(max, priceCurrency);
  }
  const hasPrice = min !== undefined || max !== undefined;
  if (filters.currency || hasPrice) apiQuery.currency = priceCurrency;

  const defaultSort: ListingSort = filters.q ? 'relevance' : 'newest';
  const sort = get('sort');
  const effectiveSort = isListingSort(sort) && (sort !== 'relevance' || filters.q) ? sort : defaultSort;
  if (effectiveSort !== defaultSort) filters.sort = apiQuery.sort = effectiveSort;

  apiQuery.page = filters.page;
  return { filters, apiQuery, effectiveSort, priceCurrency: hasPrice ? priceCurrency : undefined };
}

/** Whether anything narrows the feed (sorting and paging do not). */
export function hasActiveFilters(filters: Filters): boolean {
  return FILTER_KEYS.some((key) => key !== 'sort' && filters[key] !== undefined);
}

/** Query values in canonical order, e.g. for `buildHref`. */
export function filtersToQuery(filters: Filters): Record<string, string | number | undefined> {
  const query: Record<string, string | number | undefined> = {};
  for (const key of FILTER_KEYS) query[key] = filters[key];
  query.page = filters.page;
  return query;
}

/** `"1500"`, `"1 500,50"` → minor units in the currency; `undefined` for anything else. */
export function parseMajorAmount(value: string | undefined, currency: string): number | undefined {
  if (!value) return undefined;
  const digits = currencyDigits(currency);
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const pattern = digits > 0 ? new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`) : /^\d+$/;
  if (!pattern.test(normalized)) return undefined;
  const minor = Math.round(Number(normalized) * 10 ** digits);
  return Number.isSafeInteger(minor) && minor <= MAX_PRICE_MINOR ? minor : undefined;
}

/** Minor units → a plain major-unit string for the URL and the form (`150050` → `"1500.5"`). */
export function formatMajorAmount(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  const fixed = (minor / 10 ** digits).toFixed(digits);
  return digits > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
}

function isListingSort(value: string | undefined): value is ListingSort {
  return (LISTING_SORTS as readonly string[]).includes(value ?? '');
}

function findBySlug(tree: readonly Category[], slug: string): Category | undefined {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findBySlug(node.children, slug);
    if (found) return found;
  }
  return undefined;
}
