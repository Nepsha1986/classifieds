import { type Listing, type Paginated, listingSchema } from '@classifieds/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db, pool } from '../src/db/client.js';
import { categories, listings } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { toPrefixTsquery } from '../src/services/listings.service.js';
import { seededCategories, signUpAgent } from './helpers.js';

const app = createApp();

type Fixture = {
  title: string;
  description: string;
  category: 'cars' | 'motorcycles' | 'phones' | 'computers';
  city: string;
  price: number | null;
  currency?: string;
  status?: 'active' | 'paused' | 'sold';
};

/** Listed newest first: each fixture is one hour older than the previous one. */
const fixtures = {
  camry: {
    title: 'Toyota Camry hybrid',
    description: 'Reliable sedan, one owner',
    category: 'cars',
    city: 'Kyiv',
    price: 2_000_000,
  },
  pausedPhone: {
    title: 'iPhone 11 on hold',
    description: 'Paused for now',
    category: 'phones',
    city: 'Kyiv',
    price: 900_000,
    status: 'paused',
  },
  bmw: {
    title: 'BMW X5 diesel',
    description: 'German SUV, xDrive',
    category: 'cars',
    city: 'Lviv',
    price: 3_000_000,
    currency: 'USD',
  },
  honda: {
    title: 'Honda CB500F motorcycle',
    description: 'First bike, ABS',
    category: 'motorcycles',
    city: 'kyiv',
    price: 500_000,
  },
  soldPhone: {
    title: 'iPhone 12 sold',
    description: 'Already sold',
    category: 'phones',
    city: 'Kyiv',
    price: 1_200_000,
    status: 'sold',
  },
  iphone: {
    title: 'iPhone 13 128GB',
    description: 'Apple phone in good condition',
    category: 'phones',
    city: 'Kyiv',
    price: null,
  },
  galaxy: {
    title: 'Samsung Galaxy S22',
    description: 'Android phone, an iPhone rival',
    category: 'phones',
    city: 'Odesa',
    price: 1_000_000,
  },
  lenovo: {
    title: 'Ноутбук Lenovo',
    description: 'Легкий ноутбук для роботи',
    category: 'computers',
    city: 'Lviv',
    price: 1_500_000,
  },
} satisfies Record<string, Fixture>;
type Key = keyof typeof fixtures;
type Query = Record<string, string | number | string[]>;

const ids = {} as Record<Key, string>;
const keyById = new Map<string, Key>();
let sellerId: string;
let cat: Record<'transport' | 'cars' | 'electronics' | 'phones', number>;

beforeAll(async () => {
  // Search is global: start from an empty table so results contain only this file's fixtures.
  await db.delete(listings);
  await seededCategories();
  const rows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const { user } = await signUpAgent(app);
  sellerId = user.id;
  const now = Date.now();
  const entries = Object.entries(fixtures) as [Key, Fixture][];
  const inserted = await db
    .insert(listings)
    .values(
      entries.map(([, f], i) => ({
        sellerId: user.id,
        categoryId: bySlug.get(f.category)!,
        title: f.title,
        description: f.description,
        price: f.price,
        currency: f.currency ?? 'UAH',
        city: f.city,
        status: f.status ?? 'active',
        createdAt: new Date(now - i * 3_600_000),
      })),
    )
    .returning({ id: listings.id, title: listings.title });
  for (const [key, f] of entries) {
    const id = inserted.find((r) => r.title === f.title)!.id;
    ids[key] = id;
    keyById.set(id, key);
  }
  cat = {
    transport: bySlug.get('transport')!,
    cars: bySlug.get('cars')!,
    electronics: bySlug.get('electronics')!,
    phones: bySlug.get('phones')!,
  };
});

afterAll(async () => {
  await pool.end();
});

async function search(query: Query = {}) {
  const res = await request(app).get('/api/listings').query(query);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const body = res.body as Paginated<Listing>;
  return { ...body, keys: body.items.map((l) => keyById.get(l.id)) };
}

const searchStatus = async (query: Query) => (await request(app).get('/api/listings').query(query)).status;

describe('GET /api/listings — defaults', () => {
  it('returns active listings only, newest first, as a valid paginated response', async () => {
    const res = await search();
    expect(res.keys).toEqual(['camry', 'bmw', 'honda', 'iphone', 'galaxy', 'lenovo']);
    expect(res).toMatchObject({ page: 1, pageSize: 20, total: 6, totalPages: 1 });
    for (const item of res.items) expect(listingSchema.safeParse(item).success).toBe(true);
  });

  it('is public and needs no session', async () => {
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
  });

  it('treats empty params as unset', async () => {
    const res = await search({ q: '', city: '', category: '', minPrice: '', sort: '' });
    expect(res.total).toBe(6);
  });
});

describe('filters', () => {
  it('category includes all descendants of a parent category', async () => {
    expect((await search({ category: cat.transport })).keys).toEqual(['camry', 'bmw', 'honda']);
    expect((await search({ category: cat.electronics })).keys).toEqual(['iphone', 'galaxy', 'lenovo']);
  });

  it('category filters by a leaf category', async () => {
    expect((await search({ category: cat.cars })).keys).toEqual(['camry', 'bmw']);
    expect((await search({ category: cat.phones })).keys).toEqual(['iphone', 'galaxy']);
  });

  it('an unknown category gives an empty page', async () => {
    expect(await search({ category: 999_999 })).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('city matches exactly, ignoring case', async () => {
    expect((await search({ city: 'KYIV' })).keys).toEqual(['camry', 'honda', 'iphone']);
    expect((await search({ city: 'lviv' })).keys).toEqual(['bmw', 'lenovo']);
    expect((await search({ city: 'Ky' })).total).toBe(0);
  });

  it('price bounds are inclusive and exclude listings without a price', async () => {
    expect((await search({ minPrice: 1_500_000 })).keys).toEqual(['camry', 'bmw', 'lenovo']);
    expect((await search({ maxPrice: 1_000_000 })).keys).toEqual(['honda', 'galaxy']);
    expect((await search({ minPrice: 1_000_000, maxPrice: 1_500_000 })).keys).toEqual(['galaxy', 'lenovo']);
    expect((await search({ minPrice: 500_000, maxPrice: 500_000 })).keys).toEqual(['honda']);
    expect((await search({ minPrice: 0 })).keys).not.toContain('iphone');
  });

  it('currency restricts to one currency (case-insensitive)', async () => {
    expect((await search({ currency: 'usd' })).keys).toEqual(['bmw']);
    expect((await search({ currency: 'UAH', minPrice: 2_000_000 })).keys).toEqual(['camry']);
    expect((await search({ currency: 'EUR' })).total).toBe(0);
  });
});

describe('full-text search (q)', () => {
  it('matches title and description, title hits ranked first', async () => {
    expect((await search({ q: 'iphone' })).keys).toEqual(['iphone', 'galaxy']);
  });

  it('matches word prefixes, ignores case, requires every word', async () => {
    expect((await search({ q: 'IPH' })).keys).toEqual(['iphone', 'galaxy']);
    expect((await search({ q: 'iphone 128' })).keys).toEqual(['iphone']);
    expect((await search({ q: 'toyota bmw' })).total).toBe(0);
  });

  it('works for Cyrillic text', async () => {
    expect((await search({ q: 'ноут' })).keys).toEqual(['lenovo']);
    expect((await search({ q: 'НОУТБУК роботи' })).keys).toEqual(['lenovo']);
  });

  it('never finds paused or sold listings', async () => {
    const keys = (await search({ q: 'iphone sold' })).keys;
    expect(keys).toEqual([]);
    expect((await search({ q: 'hold' })).total).toBe(0);
  });

  it('treats tsquery syntax as plain text and matches nothing for punctuation only', async () => {
    expect((await search({ q: "iphone & | ! ( ) : * '" })).keys).toEqual(['iphone', 'galaxy']);
    expect((await search({ q: '!!! ???' })).total).toBe(0);
  });

  it('builds a prefix tsquery from letters and digits only', () => {
    expect(toPrefixTsquery('iPhone 13')).toBe('iphone:* & 13:*');
    expect(toPrefixTsquery("a'b & c|d:*")).toBe('a:* & b:* & c:* & d:*');
    expect(toPrefixTsquery('Ноутбук')).toBe('ноутбук:*');
    expect(toPrefixTsquery(' !!! ')).toBeNull();
  });
});

describe('sorting', () => {
  it('oldest first', async () => {
    expect((await search({ sort: 'oldest' })).keys).toEqual([
      'lenovo',
      'galaxy',
      'iphone',
      'honda',
      'bmw',
      'camry',
    ]);
  });

  it('by price, listings without a price last in both directions', async () => {
    expect((await search({ sort: 'price_asc' })).keys).toEqual([
      'honda',
      'galaxy',
      'lenovo',
      'camry',
      'bmw',
      'iphone',
    ]);
    expect((await search({ sort: 'price_desc' })).keys).toEqual([
      'bmw',
      'camry',
      'lenovo',
      'galaxy',
      'honda',
      'iphone',
    ]);
  });

  it('an explicit sort overrides relevance when q is set', async () => {
    expect((await search({ q: 'phone', sort: 'price_asc' })).keys).toEqual(['galaxy', 'iphone']);
    expect((await search({ q: 'phone', sort: 'relevance' })).keys).toEqual(['iphone', 'galaxy']);
  });
});

describe('combined filters', () => {
  it('category + city + q', async () => {
    expect((await search({ category: cat.electronics, city: 'kyiv', q: 'iphone' })).keys).toEqual(['iphone']);
    expect((await search({ category: cat.electronics, city: 'odesa', q: 'iphone' })).keys).toEqual([
      'galaxy',
    ]);
  });

  it('category + price + currency + sort', async () => {
    const res = await search({
      category: cat.transport,
      currency: 'UAH',
      maxPrice: 2_000_000,
      sort: 'price_desc',
    });
    expect(res.keys).toEqual(['camry', 'honda']);
  });

  it('filters that exclude each other give an empty page', async () => {
    expect((await search({ category: cat.cars, city: 'Odesa' })).total).toBe(0);
  });
});

describe('pagination', () => {
  it('splits results into non-overlapping pages with totals', async () => {
    const pages = await Promise.all([1, 2, 3].map((page) => search({ pageSize: 2, page })));
    expect(pages.map((p) => p.keys)).toEqual([
      ['camry', 'bmw'],
      ['honda', 'iphone'],
      ['galaxy', 'lenovo'],
    ]);
    for (const p of pages) expect(p).toMatchObject({ total: 6, totalPages: 3, pageSize: 2 });
  });

  it('a partial last page and a page past the end', async () => {
    expect((await search({ pageSize: 4, page: 2 })).keys).toEqual(['galaxy', 'lenovo']);
    expect(await search({ pageSize: 4, page: 3 })).toMatchObject({ items: [], total: 6, totalPages: 2 });
  });

  it('pagination applies after filtering', async () => {
    const res = await search({ category: cat.transport, pageSize: 2, page: 2 });
    expect(res).toMatchObject({ total: 3, totalPages: 2 });
    expect(res.keys).toEqual(['honda']);
  });

  it('accepts the maximum page size', async () => {
    expect((await search({ pageSize: 100 })).total).toBe(6);
  });
});

describe('seller', () => {
  it("returns only that seller's active listings", async () => {
    const { user: other } = await signUpAgent(app);
    const [own] = await db
      .insert(listings)
      .values({
        sellerId: other.id,
        categoryId: cat.cars,
        title: 'Other seller car',
        description: 'Not from the fixtures seller',
        price: 100,
        city: 'Kyiv',
      })
      .returning({ id: listings.id });
    try {
      const mine = await search({ seller: sellerId });
      expect(mine.keys).toEqual(['camry', 'bmw', 'honda', 'iphone', 'galaxy', 'lenovo']);
      const theirs = await search({ seller: other.id });
      expect(theirs.items.map((l) => l.id)).toEqual([own!.id]);
      expect((await search({ seller: other.id, city: 'Lviv' })).total).toBe(0);
      expect((await search({ seller: crypto.randomUUID() })).total).toBe(0);
    } finally {
      await db.delete(listings).where(eq(listings.id, own!.id));
    }
  });
});

describe('validation', () => {
  it.each<Query>([
    { page: 0 },
    { pageSize: 101 },
    { pageSize: 'ten' },
    { category: 'cars' },
    { minPrice: -1 },
    { maxPrice: '1.5' },
    { minPrice: 10, maxPrice: 5 },
    { currency: 'hryvnia' },
    { sort: 'cheapest' },
    { sort: 'relevance' },
    { q: 'x'.repeat(201) },
    { city: ['Kyiv', 'Lviv'] },
    { seller: 'not-a-uuid' },
  ])('400 for %j', async (query) => {
    expect(await searchStatus(query)).toBe(400);
  });
});
