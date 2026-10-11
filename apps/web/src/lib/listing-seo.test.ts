import type { Listing } from '@classifieds/shared';
import { describe, expect, it } from 'vitest';
import { jsonForScript, listingJsonLd, summarize } from './listing-seo';

const listing: Listing = {
  id: '6f1c6c55-0d3c-4b8e-9a39-2f3f3b1f5c11',
  sellerId: 'u1',
  categoryId: 2,
  title: 'Mountain bike',
  description: 'Good  bike,\n\nbarely used.',
  price: 1_400_050,
  currency: 'UAH',
  city: 'Odesa',
  status: 'active',
  attributes: {},
  photos: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

describe('summarize', () => {
  it('collapses whitespace', () => {
    expect(summarize('a\n\n b   c')).toBe('a b c');
  });

  it('cuts long text at a word boundary', () => {
    const text = 'word '.repeat(100);
    const summary = summarize(text, 30);
    expect(summary.length).toBeLessThanOrEqual(30);
    expect(summary).toMatch(/^(word )*word…$/);
  });
});

describe('listingJsonLd', () => {
  it('describes the offer', () => {
    const ld = listingJsonLd(listing, 'https://x/listings/1', ['https://api/uploads/a.png']);
    expect(ld).toMatchObject({
      '@type': 'Product',
      name: 'Mountain bike',
      image: ['https://api/uploads/a.png'],
      offers: { price: '14000.50', priceCurrency: 'UAH', availability: 'https://schema.org/InStock' },
    });
  });

  it('marks sold listings and omits a missing price', () => {
    const ld = listingJsonLd({ ...listing, status: 'sold', price: null }, 'u', []);
    expect(ld.offers).toEqual(expect.objectContaining({ availability: 'https://schema.org/SoldOut' }));
    expect(ld.offers).not.toHaveProperty('price');
    expect(ld).not.toHaveProperty('image');
  });
});

describe('jsonForScript', () => {
  it('cannot close the script tag', () => {
    expect(jsonForScript({ t: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});
