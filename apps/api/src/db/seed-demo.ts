import { fileURLToPath } from 'node:url';
import type { ListingAttributes, ListingStatus } from '@classifieds/shared';
import { eq, inArray } from 'drizzle-orm';
import { auth } from '../auth/auth.js';
import { db } from './client.js';
import { categories, listings, users } from './schema.js';
import { seedCategories } from './seed.js';

/** Demo accounts; all share one password so they can sign in to the merchant portal. */
export const DEMO_PASSWORD = 'demo-password';

const demoUsers = [
  { email: 'olena@demo.classifieds', name: 'Olena Kovalenko', phone: '+380501112233', city: 'Kyiv' },
  { email: 'taras@demo.classifieds', name: 'Taras Shevchuk', phone: '+380672223344', city: 'Lviv' },
  { email: 'iryna@demo.classifieds', name: 'Iryna Bondar', phone: '+380933334455', city: 'Odesa' },
] as const;

type DemoListing = {
  seller: 0 | 1 | 2;
  category: string;
  title: string;
  description: string;
  /** Major units (hryvnias/dollars); stored as minor units. `null` = price on request. */
  price: number | null;
  currency?: string;
  city: string;
  status?: ListingStatus;
  daysAgo: number;
  attributes?: ListingAttributes;
};

const demoListings: DemoListing[] = [
  {
    seller: 0,
    category: 'cars',
    title: 'Toyota Camry 2018, hybrid',
    description: 'One owner, full service history, 92 000 km. Hybrid, automatic, leather seats.',
    price: 21500,
    currency: 'USD',
    city: 'Kyiv',
    daysAgo: 1,
    attributes: { year: 2018, mileage: 92000, fuel: 'hybrid' },
  },
  {
    seller: 1,
    category: 'cars',
    title: 'Volkswagen Golf 7, diesel',
    description: 'Economical diesel, 1.6 TDI, manual gearbox. New tires.',
    price: 11200,
    currency: 'USD',
    city: 'Lviv',
    daysAgo: 3,
    attributes: { year: 2015, mileage: 168000, fuel: 'diesel' },
  },
  {
    seller: 2,
    category: 'cars',
    title: 'BMW X5 2016',
    description: 'xDrive, panoramic roof, diesel. Well maintained.',
    price: 27900,
    currency: 'USD',
    city: 'Odesa',
    daysAgo: 9,
    attributes: { year: 2016, mileage: 140000, fuel: 'diesel' },
  },
  {
    seller: 1,
    category: 'cars',
    title: 'Daewoo Lanos for parts',
    description: 'Does not start; body in fair condition. Sold as is.',
    price: null,
    city: 'Lviv',
    status: 'paused',
    daysAgo: 20,
  },
  {
    seller: 0,
    category: 'motorcycles',
    title: 'Honda CB500F',
    description: 'Great first motorcycle, 18 000 km, ABS.',
    price: 5200,
    currency: 'USD',
    city: 'Kyiv',
    daysAgo: 5,
    attributes: { year: 2019, mileage: 18000 },
  },
  {
    seller: 2,
    category: 'auto-parts',
    title: 'Winter tires R16, set of 4',
    description: 'Nokian, 205/55 R16, two seasons of use.',
    price: 6000,
    city: 'Odesa',
    daysAgo: 2,
  },
  {
    seller: 0,
    category: 'apartments',
    title: '2-room apartment near the metro',
    description: 'Long-term rent, renovated, furniture and appliances included. 5 minutes to the metro.',
    price: 18000,
    city: 'Kyiv',
    daysAgo: 0,
    attributes: { rooms: 2, area: 54, floor: 7 },
  },
  {
    seller: 1,
    category: 'apartments',
    title: '1-room apartment in the old town',
    description: 'Cozy apartment for rent in a historic building, high ceilings.',
    price: 14000,
    city: 'Lviv',
    daysAgo: 4,
    attributes: { rooms: 1, area: 38, floor: 2 },
  },
  {
    seller: 2,
    category: 'apartments',
    title: 'Sea view apartment',
    description: '3 rooms, sea view, new building with parking. For sale.',
    price: 95000,
    currency: 'USD',
    city: 'Odesa',
    daysAgo: 12,
    attributes: { rooms: 3, area: 86, floor: 14 },
  },
  {
    seller: 1,
    category: 'houses',
    title: 'House with a garden',
    description: 'Two-storey house, 120 m², 10 acres of land, garage.',
    price: 78000,
    currency: 'USD',
    city: 'Lviv',
    status: 'sold',
    daysAgo: 30,
    attributes: { rooms: 5, area: 120 },
  },
  {
    seller: 0,
    category: 'rooms',
    title: 'Room for a student',
    description: 'Room in a shared apartment, near the university.',
    price: 5000,
    city: 'Kyiv',
    daysAgo: 6,
  },
  {
    seller: 0,
    category: 'phones',
    title: 'iPhone 13, 128 GB',
    description: 'Midnight color, battery 89%, always in a case. Box and cable included.',
    price: 17500,
    city: 'Kyiv',
    daysAgo: 1,
    attributes: { storage: 128, color: 'midnight' },
  },
  {
    seller: 1,
    category: 'phones',
    title: 'iPhone 12 mini',
    description: 'Small and fast, 64 GB, minor scratches on the frame.',
    price: 9800,
    city: 'Lviv',
    daysAgo: 7,
    attributes: { storage: 64 },
  },
  {
    seller: 2,
    category: 'phones',
    title: 'Samsung Galaxy S22',
    description: '256 GB, phantom black, like new.',
    price: 15000,
    city: 'Odesa',
    daysAgo: 2,
    attributes: { storage: 256 },
  },
  {
    seller: 2,
    category: 'phones',
    title: 'Xiaomi Redmi Note 11',
    description: 'Working phone, cracked back glass.',
    price: 3200,
    city: 'Odesa',
    status: 'sold',
    daysAgo: 15,
  },
  {
    seller: 0,
    category: 'computers',
    title: 'MacBook Air M1',
    description: '8 GB RAM, 256 GB SSD, 150 battery cycles. Perfect for study and work.',
    price: 24000,
    city: 'Kyiv',
    daysAgo: 3,
    attributes: { ram: 8, ssd: 256 },
  },
  {
    seller: 1,
    category: 'computers',
    title: 'Gaming PC, RTX 3070',
    description: 'Ryzen 7 5800X, 32 GB RAM, 1 TB NVMe. Runs every modern game.',
    price: 42000,
    city: 'Lviv',
    daysAgo: 8,
    attributes: { ram: 32 },
  },
  {
    seller: 2,
    category: 'computers',
    title: 'Lenovo ThinkPad T480',
    description: 'Business laptop, i5, 16 GB RAM, new battery.',
    price: 11000,
    city: 'Odesa',
    daysAgo: 11,
    attributes: { ram: 16, ssd: 512 },
  },
  {
    seller: 0,
    category: 'tv-audio',
    title: 'Sony WH-1000XM4 headphones',
    description: 'Noise cancelling headphones, full set with the case.',
    price: 7000,
    city: 'Kyiv',
    daysAgo: 4,
  },
  {
    seller: 1,
    category: 'tv-audio',
    title: 'LG OLED TV 55"',
    description: '4K OLED, 2021 model, wall mount included.',
    price: 32000,
    city: 'Lviv',
    daysAgo: 14,
  },
  {
    seller: 2,
    category: 'furniture',
    title: 'Corner sofa',
    description: 'Grey fabric sofa, folds out into a bed. Pick-up only.',
    price: 8500,
    city: 'Odesa',
    daysAgo: 5,
  },
  {
    seller: 0,
    category: 'furniture',
    title: 'Oak dining table',
    description: 'Solid oak table for six, with four chairs.',
    price: 12000,
    city: 'Kyiv',
    daysAgo: 16,
  },
  {
    seller: 1,
    category: 'appliances',
    title: 'Bosch washing machine',
    description: '7 kg, A+++ energy class, works perfectly.',
    price: 6500,
    city: 'Lviv',
    daysAgo: 2,
  },
  {
    seller: 2,
    category: 'appliances',
    title: 'Coffee machine DeLonghi',
    description: 'Automatic bean-to-cup coffee machine, descaled regularly.',
    price: 9000,
    city: 'Odesa',
    daysAgo: 10,
  },
  {
    seller: 0,
    category: 'garden',
    title: 'Lawn mower, electric',
    description: '1600 W, 38 cm cutting width, grass box.',
    price: 2800,
    city: 'Kyiv',
    daysAgo: 18,
  },
  {
    seller: 1,
    category: 'clothing',
    title: 'Winter jacket, size M',
    description: 'Down jacket, warm and light, worn one season.',
    price: 2200,
    city: 'Lviv',
    daysAgo: 6,
  },
  {
    seller: 2,
    category: 'shoes',
    title: 'Running shoes Nike Pegasus',
    description: 'Size 43, used for a few runs only.',
    price: 2500,
    city: 'Odesa',
    daysAgo: 3,
  },
  {
    seller: 0,
    category: 'accessories',
    title: 'Leather backpack',
    description: 'Handmade leather backpack, fits a 14" laptop.',
    price: 3500,
    city: 'Kyiv',
    daysAgo: 13,
  },
  {
    seller: 1,
    category: 'kids',
    title: 'Baby stroller 2 in 1',
    description: 'Carrycot and seat, rain cover included.',
    price: 7500,
    city: 'Lviv',
    daysAgo: 9,
  },
  {
    seller: 2,
    category: 'hobbies-sports',
    title: 'Mountain bike',
    description: '29" wheels, aluminium frame, hydraulic disc brakes.',
    price: 14000,
    city: 'Odesa',
    daysAgo: 1,
  },
  {
    seller: 0,
    category: 'hobbies-sports',
    title: 'Велосипед міський',
    description: 'Міський велосипед з кошиком, 7 швидкостей.',
    price: 6000,
    city: 'Kyiv',
    daysAgo: 7,
  },
  {
    seller: 1,
    category: 'hobbies-sports',
    title: 'Acoustic guitar Yamaha F310',
    description: 'Great guitar for beginners, with a soft case.',
    price: 4200,
    city: 'Lviv',
    daysAgo: 21,
  },
  {
    seller: 2,
    category: 'services',
    title: 'Apartment cleaning',
    description: 'Regular and post-renovation cleaning, own supplies.',
    price: null,
    city: 'Odesa',
    daysAgo: 4,
  },
  {
    seller: 0,
    category: 'services',
    title: 'English tutor online',
    description: 'Lessons for adults and teens, all levels. 60 minutes.',
    price: 500,
    city: 'Kyiv',
    daysAgo: 2,
  },
  {
    seller: 1,
    category: 'jobs',
    title: 'Barista wanted',
    description: 'Coffee shop in the city center, flexible schedule.',
    price: null,
    city: 'Lviv',
    daysAgo: 1,
  },
  {
    seller: 2,
    category: 'pets',
    title: 'British shorthair kittens',
    description: 'Vaccinated, litter trained, ready for a new home.',
    price: 4000,
    city: 'Odesa',
    daysAgo: 8,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sample users and listings for development and demos. Skipped when the demo users already exist,
 * so it can run repeatedly without duplicating data. Never run it in production.
 */
export async function seedDemo(now = new Date()): Promise<{ users: number; listings: number } | null> {
  const emails = demoUsers.map((u) => u.email);
  const existing = await db.select({ id: users.id }).from(users).where(inArray(users.email, emails));
  if (existing.length > 0) return null;

  await seedCategories(db);
  const categoryRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const categoryId = new Map(categoryRows.map((c) => [c.slug, c.id]));

  const sellerIds: string[] = [];
  for (const demo of demoUsers) {
    // Through better-auth so the password is hashed exactly like a real sign-up.
    const { user } = await auth.api.signUpEmail({
      body: { email: demo.email, password: DEMO_PASSWORD, name: demo.name },
    });
    await db.update(users).set({ phone: demo.phone, city: demo.city }).where(eq(users.id, user.id));
    sellerIds.push(user.id);
  }

  await db.insert(listings).values(
    demoListings.map((l, i) => {
      const id = categoryId.get(l.category);
      if (id === undefined) throw new Error(`Unknown demo category: ${l.category}`);
      // Spread listings over the day as well, so "newest" order is stable and readable.
      const createdAt = new Date(now.getTime() - l.daysAgo * DAY_MS - i * 60_000);
      return {
        sellerId: sellerIds[l.seller]!,
        categoryId: id,
        title: l.title,
        description: l.description,
        price: l.price === null ? null : l.price * 100,
        currency: l.currency ?? 'UAH',
        city: l.city,
        status: l.status ?? 'active',
        attributes: l.attributes ?? {},
        createdAt,
        updatedAt: createdAt,
      };
    }),
  );
  return { users: demoUsers.length, listings: demoListings.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { pool } = await import('./client.js');
  const result = await seedDemo();
  await pool.end();
  console.log(
    result
      ? `Demo seed complete: ${result.users} users, ${result.listings} listings (password: ${DEMO_PASSWORD})`
      : 'Demo data already present, skipped',
  );
}
