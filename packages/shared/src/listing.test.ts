import { describe, expect, it } from 'vitest';
import {
  canChangeListingStatus,
  changeListingStatusInputSchema,
  createListingInputSchema,
  listingSearchQuerySchema,
  updateListingInputSchema,
} from './listing.js';

const valid = { title: '  iPhone 13 ', description: 'Good condition', city: 'Kyiv', categoryId: 7 };

describe('createListingInputSchema', () => {
  it('applies defaults and normalizes values', () => {
    expect(createListingInputSchema.parse({ ...valid, currency: 'usd' })).toEqual({
      ...valid,
      title: 'iPhone 13',
      price: null,
      currency: 'USD',
      attributes: {},
    });
  });

  it('accepts integer prices in minor units and scalar attributes', () => {
    const parsed = createListingInputSchema.parse({
      ...valid,
      price: 1500000,
      attributes: { storage: 128, used: true },
    });
    expect(parsed.price).toBe(1500000);
    expect(parsed.attributes).toEqual({ storage: 128, used: true });
  });

  it('rejects invalid input', () => {
    const bad = [
      { ...valid, title: 'ab' },
      { ...valid, price: -1 },
      { ...valid, price: 10.5 },
      { ...valid, currency: 'hryvnia' },
      { ...valid, categoryId: '7' },
      { ...valid, attributes: { 'bad key': 1 } },
      { ...valid, attributes: { nested: { a: 1 } } },
      { ...valid, status: 'sold' },
      { ...valid, sellerId: 'someone' },
      { title: 'Only a title' },
    ];
    for (const input of bad)
      expect(createListingInputSchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
  });
});

describe('updateListingInputSchema', () => {
  it('accepts partial updates, including clearing the price', () => {
    expect(updateListingInputSchema.parse({ price: null })).toEqual({ price: null });
    expect(updateListingInputSchema.parse({ city: ' Lviv ' })).toEqual({ city: 'Lviv' });
  });

  it('rejects empty updates, status and unknown fields', () => {
    expect(updateListingInputSchema.safeParse({}).success).toBe(false);
    expect(updateListingInputSchema.safeParse({ status: 'sold' }).success).toBe(false);
    expect(updateListingInputSchema.safeParse({ foo: 1 }).success).toBe(false);
  });
});

describe('listing status', () => {
  it('validates the status input', () => {
    expect(changeListingStatusInputSchema.safeParse({ status: 'paused' }).success).toBe(true);
    expect(changeListingStatusInputSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('allows only the defined transitions', () => {
    expect(canChangeListingStatus('active', 'paused')).toBe(true);
    expect(canChangeListingStatus('paused', 'active')).toBe(true);
    expect(canChangeListingStatus('active', 'sold')).toBe(true);
    expect(canChangeListingStatus('paused', 'sold')).toBe(true);
    expect(canChangeListingStatus('sold', 'active')).toBe(false);
    expect(canChangeListingStatus('sold', 'paused')).toBe(false);
    expect(canChangeListingStatus('sold', 'sold')).toBe(true);
  });
});

describe('listingSearchQuerySchema', () => {
  it('applies pagination defaults and leaves filters unset', () => {
    expect(listingSearchQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepts a seller ID and rejects anything else', () => {
    const seller = '6f1c6c55-0d3c-4b8e-9a39-2f3f3b1f5c11';
    expect(listingSearchQuerySchema.parse({ seller })).toMatchObject({ seller });
    expect(listingSearchQuerySchema.parse({ seller: '' }).seller).toBeUndefined();
    expect(listingSearchQuerySchema.safeParse({ seller: 'bob' }).success).toBe(false);
  });

  it('coerces and normalizes query-string values', () => {
    expect(
      listingSearchQuerySchema.parse({
        q: '  iphone 13 ',
        category: '3',
        city: ' Kyiv ',
        minPrice: '1000',
        maxPrice: '5000',
        currency: 'usd',
        sort: 'price_asc',
        page: '2',
        pageSize: '10',
      }),
    ).toEqual({
      q: 'iphone 13',
      category: 3,
      city: 'Kyiv',
      minPrice: 1000,
      maxPrice: 5000,
      currency: 'USD',
      sort: 'price_asc',
      page: 2,
      pageSize: 10,
    });
  });

  it('treats empty and blank params as unset', () => {
    expect(
      listingSearchQuerySchema.parse({ q: '  ', category: '', city: '', minPrice: '', sort: '' }),
    ).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepts equal price bounds and relevance with a query', () => {
    expect(listingSearchQuerySchema.safeParse({ minPrice: '5', maxPrice: '5' }).success).toBe(true);
    expect(listingSearchQuerySchema.safeParse({ q: 'bike', sort: 'relevance' }).success).toBe(true);
  });

  it('rejects invalid values', () => {
    const bad = [
      { category: 'cars' },
      { category: '0' },
      { minPrice: '-1' },
      { maxPrice: '1.5' },
      { minPrice: '10', maxPrice: '5' },
      { currency: 'hryvnia' },
      { sort: 'cheapest' },
      { sort: 'relevance' },
      { q: 'x'.repeat(201) },
      { city: ['Kyiv', 'Lviv'] },
      { page: '0' },
    ];
    for (const input of bad)
      expect(listingSearchQuerySchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
  });
});

describe('listing input messages', () => {
  it('explains what is wrong in plain words', () => {
    const result = createListingInputSchema.safeParse({
      title: 'ab',
      description: ' ',
      city: '',
      categoryId: 1,
    });
    expect(result.error?.issues.map((i) => i.message).sort()).toEqual([
      'City is required',
      'Description is required',
      'Title must be at least 3 characters',
    ]);
  });
});
