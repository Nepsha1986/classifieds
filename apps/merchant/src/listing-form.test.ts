import { describe, expect, it } from 'vitest';
import {
  emptyListingForm,
  formatMajor,
  leafCategoryOptions,
  listingFormResolver,
  listingToForm,
  parseMajor,
  type ListingFormValues,
} from './listing-form';
import { categoryTree, makeListing } from './test/render';

const resolve = (values: ListingFormValues) =>
  listingFormResolver(values, undefined, { fields: {}, shouldUseNativeValidation: false });

const valid: ListingFormValues = {
  title: '  Road bike  ',
  description: 'Fast and light',
  price: '12 500,50',
  currency: 'UAH',
  city: 'Kyiv',
  categoryId: '2',
};

describe('parseMajor / formatMajor', () => {
  it('turns typed amounts into minor units', () => {
    expect(parseMajor('1500', 'UAH')).toBe(150_000);
    expect(parseMajor('1 500,5', 'UAH')).toBe(150_050);
    expect(parseMajor('0.05', 'USD')).toBe(5);
    expect(parseMajor('5000', 'JPY')).toBe(5000);
    expect(parseMajor('  ', 'UAH')).toBeNull();
  });

  it('rejects text that is not a price', () => {
    for (const text of ['abc', '-5', '1.234', '1e5', '1.2.3', '12.5']) {
      expect(parseMajor(text, text === '12.5' ? 'JPY' : 'UAH')).toBeUndefined();
    }
  });

  it('formats minor units for the input', () => {
    expect(formatMajor(150_000, 'UAH')).toBe('1500');
    expect(formatMajor(150_050, 'UAH')).toBe('1500.50');
    expect(formatMajor(5000, 'JPY')).toBe('5000');
    expect(parseMajor(formatMajor(123_456, 'EUR'), 'EUR')).toBe(123_456);
  });
});

describe('listingFormResolver', () => {
  it('produces API input checked by the shared schema', async () => {
    const result = await resolve(valid);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      title: 'Road bike',
      description: 'Fast and light',
      price: 1_250_050,
      currency: 'UAH',
      city: 'Kyiv',
      categoryId: 2,
      attributes: {},
    });
  });

  it('treats an empty price as price on request', async () => {
    expect((await resolve({ ...valid, price: '' })).values).toMatchObject({ price: null });
  });

  it('reports errors per field', async () => {
    const result = await resolve({ ...emptyListingForm(), title: 'ab', price: 'cheap' });
    expect(Object.keys(result.errors).sort()).toEqual([
      'categoryId',
      'city',
      'description',
      'price',
      'title',
    ]);
    expect(result.errors.price?.message).toMatch(/Enter a price/);
    expect(result.errors.categoryId?.message).toBe('Choose a category');
  });

  it('rejects a price above the limit', async () => {
    expect((await resolve({ ...valid, price: '30000000' })).errors.price?.message).toBe('Price is too large');
  });
});

describe('listingToForm', () => {
  it('fills the form from a listing', () => {
    expect(listingToForm(makeListing({ price: 99_950, categoryId: 5, title: 'T' }))).toMatchObject({
      title: 'T',
      price: '999.50',
      categoryId: '5',
    });
    expect(listingToForm(makeListing({ price: null })).price).toBe('');
  });
});

describe('leafCategoryOptions', () => {
  it('offers only leaves, grouped by top-level category', () => {
    expect(
      leafCategoryOptions([
        ...categoryTree,
        { id: 9, parentId: null, slug: 'misc', name: 'Misc', children: [] },
        {
          id: 10,
          parentId: null,
          slug: 'home',
          name: 'Home',
          children: [
            {
              id: 11,
              parentId: 10,
              slug: 'furniture',
              name: 'Furniture',
              children: [{ id: 12, parentId: 11, slug: 'sofas', name: 'Sofas', children: [] }],
            },
          ],
        },
      ]),
    ).toEqual([
      { label: 'Transport', options: [{ id: 2, label: 'Cars' }] },
      { label: 'Electronics', options: [{ id: 5, label: 'Phones' }] },
      { label: 'Misc', options: [{ id: 9, label: 'Misc' }] },
      { label: 'Home', options: [{ id: 12, label: 'Furniture / Sofas' }] },
    ]);
  });
});
