import { LISTING_STATUSES } from '@classifieds/shared';
import { type SQL, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
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

// --- Authentication (better-auth core tables; plural names via `usePlural`) ---

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // Profile fields (better-auth `additionalFields`), editable via PATCH /api/me.
    phone: varchar('phone', { length: 32 }),
    city: varchar('city', { length: 100 }),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (t) => [uniqueIndex('sessions_token_idx').on(t.token), index('sessions_user_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    // Password hash for the email + password provider.
    password: text('password'),
    ...timestamps,
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

// --- Listings ---

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

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
    sellerId: text('seller_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    // Full-text search document: the title weighs more than the description. The `simple` config only
    // lower-cases words (no stemming), so Ukrainian, Russian and English text is treated alike;
    // queries use prefix matching instead (see listings.service).
    searchVector: tsvector('search_vector')
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`setweight(to_tsvector('simple', ${listings.title}), 'A') || setweight(to_tsvector('simple', ${listings.description}), 'B')`,
      ),
    ...timestamps,
  },
  (t) => [
    index('listings_search_idx').using('gin', t.searchVector),
    // The seller's own listings, newest first (`GET /api/me/listings`).
    index('listings_seller_created_idx').on(t.sellerId, t.createdAt),
    index('listings_category_idx').on(t.categoryId),
    index('listings_status_created_idx').on(t.status, t.createdAt),
    // Public search covers active listings only, so its filter indexes are partial.
    index('listings_active_category_created_idx')
      .on(t.categoryId, t.createdAt)
      .where(sql`${t.status} = 'active'`),
    index('listings_active_city_idx')
      .on(sql`lower(${t.city})`)
      .where(sql`${t.status} = 'active'`),
    index('listings_active_price_idx')
      .on(t.price)
      .where(sql`${t.status} = 'active'`),
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
