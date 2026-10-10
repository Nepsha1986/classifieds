import { LISTING_STATUSES } from '@classifieds/shared';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const listingStatus = pgEnum('listing_status', LISTING_STATUSES);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('categories_slug_idx').on(t.slug), index('categories_parent_idx').on(t.parentId)],
);

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // References the auth user table, added together with authentication (Stage 2).
    sellerId: text('seller_id').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 120 }).notNull(),
    description: text('description').notNull(),
    // Minor currency units (kopecks/cents); null means "price on request".
    price: integer('price'),
    currency: varchar('currency', { length: 3 }).notNull().default('UAH'),
    city: varchar('city', { length: 100 }).notNull(),
    status: listingStatus('status').notNull().default('active'),
    // Niche-specific fields (e.g. mileage, rooms, size) without schema changes.
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('listings_seller_idx').on(t.sellerId),
    index('listings_category_idx').on(t.categoryId),
    index('listings_status_created_idx').on(t.status, t.createdAt),
    check('listings_price_non_negative', sql`${t.price} IS NULL OR ${t.price} >= 0`),
  ],
);

export const listingPhotos = pgTable(
  'listing_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('listing_photos_listing_idx').on(t.listingId, t.position)],
);
