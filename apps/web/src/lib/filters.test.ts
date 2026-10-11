import { listingSearchQuerySchema, type Category } from '@classifieds/shared';
import { describe, expect, it } from 'vitest';
import {
  filtersToQuery,
  formatMajorAmount,
  hasActiveFilters,
  parseFilters,
  parseMajorAmount,
} from './filters';
import { buildHref } from './search-params';

const node = (id: number, slug: string, children: Category[] = [], parentId: number | null = null) => ({
  id,
  parentId,
  slug,
  name: slug,
  children,
});
const categories: Category[] = [node(1, 'transport', [node(2, 'cars', [], 1)]), node(3, 'pets')];

const parse = (raw: Record<string, string | string[]>) => parseFilters(raw, categories);

describe('parseFilters', () => {
  it('gives the plain feed for an empty URL', () => {
    const parsed = parse({});
    expect(parsed.filters).toEqual({ page: 1 });
    expect(parsed.apiQuery).toEqual({ page: 1 });
    expect(parsed.effectiveSort).toBe('newest');
    expect(hasActiveFilters(parsed.filters)).toBe(false);
  });

  it('maps every filter to the API query', () => {
    const parsed = parse({
      q: '  red bike ',
      category: 'transport',
      city: 'Kyiv',
      minPrice: '1 000',
      maxPrice: '2500,50',
      currency: 'usd',
      sort: 'price_asc',
      page: '2',
    });
    expect(parsed.filters).toEqual({
      q: 'red bike',
      category: 'transport',
      city: 'Kyiv',
      minPrice: '1000',
      maxPrice: '2500.5',
      currency: 'USD',
      sort: 'price_asc',
      page: 2,
    });
    expect(parsed.apiQuery).toEqual({
      q: 'red bike',
      category: 1,
      city: 'Kyiv',
      minPrice: 100_000,
      maxPrice: 250_050,
      currency: 'USD',
      sort: 'price_asc',
      page: 2,
    });
    expect(parsed.priceCurrency).toBe('USD');
    expect(hasActiveFilters(parsed.filters)).toBe(true);
  });

  it('finds nested categories by slug and ignores unknown ones', () => {
    expect(parse({ category: 'cars' }).apiQuery.category).toBe(2);
    const unknown = parse({ category: 'nope' });
    expect(unknown.filters.category).toBeUndefined();
    expect(unknown.apiQuery.category).toBeUndefined();
  });

  it('compares prices in the default currency when none is chosen', () => {
    const parsed = parse({ minPrice: '100' });
    expect(parsed.apiQuery).toMatchObject({ minPrice: 10_000, currency: 'UAH' });
    expect(parsed.filters.currency).toBeUndefined();
    expect(parsed.priceCurrency).toBe('UAH');
  });

  it('swaps reversed price bounds', () => {
    expect(parse({ minPrice: '500', maxPrice: '100' }).filters).toMatchObject({
      minPrice: '100',
      maxPrice: '500',
    });
  });

  it('drops invalid values', () => {
    const parsed = parse({
      q: '   ',
      city: 'x'.repeat(101),
      minPrice: '-5',
      maxPrice: '12abc',
      currency: 'dollars',
      sort: 'cheapest',
      page: '0',
    });
    expect(parsed.filters).toEqual({ page: 1 });
    expect(parsed.apiQuery).toEqual({ page: 1 });
  });

  it('keeps the first of repeated params', () => {
    expect(parse({ city: ['Lviv', 'Kyiv'] }).filters.city).toBe('Lviv');
  });

  it('applies relevance by default with a query and leaves default sorts out of the URL', () => {
    expect(parse({ q: 'bike' }).effectiveSort).toBe('relevance');
    expect(parse({ q: 'bike', sort: 'relevance' }).filters.sort).toBeUndefined();
    expect(parse({ sort: 'newest' }).filters.sort).toBeUndefined();
    expect(parse({ q: 'bike', sort: 'newest' }).filters.sort).toBe('newest');
  });

  it('ignores relevance without a query', () => {
    const parsed = parse({ sort: 'relevance' });
    expect(parsed.effectiveSort).toBe('newest');
    expect(parsed.apiQuery.sort).toBeUndefined();
  });

  it('always produces a query the API accepts', () => {
    const urls: Record<string, string>[] = [
      {},
      { q: 'bike', sort: 'relevance' },
      { sort: 'relevance' },
      { minPrice: '9', maxPrice: '1' },
      { minPrice: '99999999999' },
      { q: 'x'.repeat(500) },
      { currency: 'eur', maxPrice: '10.999' },
    ];
    for (const raw of urls) {
      expect(listingSearchQuerySchema.safeParse(parse(raw).apiQuery).success).toBe(true);
    }
  });

  it('is stable: the canonical URL parses to itself', () => {
    const first = parse({ q: ' bike ', city: 'Kyiv', minPrice: '1,5', sort: 'newest', page: '3', utm: 'x' });
    const href = buildHref('/', filtersToQuery(first.filters));
    expect(href).toBe('/?q=bike&city=Kyiv&minPrice=1.5&sort=newest&page=3');
    const again = parse(Object.fromEntries(new URL(href, 'http://x').searchParams));
    expect(again.filters).toEqual(first.filters);
  });
});

describe('major amounts', () => {
  it('parses major units into minor units', () => {
    expect(parseMajorAmount('1500', 'UAH')).toBe(150_000);
    expect(parseMajorAmount('1 500,5', 'UAH')).toBe(150_050);
    expect(parseMajorAmount('1500', 'JPY')).toBe(1500);
    expect(parseMajorAmount('1500.5', 'JPY')).toBeUndefined();
    expect(parseMajorAmount('1.234', 'UAH')).toBeUndefined();
    expect(parseMajorAmount('30000000', 'UAH')).toBeUndefined();
  });

  it('formats minor units back without trailing zeros', () => {
    expect(formatMajorAmount(150_000, 'UAH')).toBe('1500');
    expect(formatMajorAmount(150_050, 'UAH')).toBe('1500.5');
    expect(formatMajorAmount(0, 'UAH')).toBe('0');
    expect(formatMajorAmount(1500, 'JPY')).toBe('1500');
  });
});
