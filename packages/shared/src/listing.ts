import { z } from 'zod';
import { paginationQuerySchema } from './pagination.js';
import { listingPhotoSchema } from './photo.js';

export const LISTING_STATUSES = ['active', 'paused', 'sold'] as const;

export const listingStatusSchema = z.enum(LISTING_STATUSES);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

/**
 * Allowed status changes. `sold` is final: a sold item is not put back on sale, a new listing is
 * created instead. Setting the current status again is a no-op and is always allowed.
 */
export const LISTING_STATUS_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  active: ['paused', 'sold'],
  paused: ['active', 'sold'],
  sold: [],
};

export function canChangeListingStatus(from: ListingStatus, to: ListingStatus): boolean {
  return from === to || LISTING_STATUS_TRANSITIONS[from].includes(to);
}

export const LISTING_TITLE_MAX = 120;
export const LISTING_DESCRIPTION_MAX = 5000;
export const LISTING_ATTRIBUTES_MAX = 30;
export const DEFAULT_CURRENCY = 'UAH';

/** Niche-specific fields: flat key → scalar map (e.g. `{ mileage: 120000, fuel: "diesel" }`). */
export const listingAttributesSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Attribute keys are identifiers like "mileage" or "room_count"'),
    z.union([z.string().max(200), z.number().finite(), z.boolean()]),
  )
  .refine(
    (v) => Object.keys(v).length <= LISTING_ATTRIBUTES_MAX,
    `At most ${LISTING_ATTRIBUTES_MAX} attributes`,
  );
export type ListingAttributes = z.infer<typeof listingAttributesSchema>;

const listingFields = {
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(LISTING_TITLE_MAX, `Title must be at most ${LISTING_TITLE_MAX} characters`),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(LISTING_DESCRIPTION_MAX, `Description must be at most ${LISTING_DESCRIPTION_MAX} characters`),
  /** Minor currency units (kopecks/cents); `null` means "price on request". */
  price: z.number().int().min(0).max(2_000_000_000).nullable(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code'),
  city: z.string().trim().min(1, 'City is required').max(100, 'City must be at most 100 characters'),
  categoryId: z.number().int().positive(),
  attributes: listingAttributesSchema,
};

/** `POST /api/listings`. New listings always start as `active`; the seller is the signed-in user. */
export const createListingInputSchema = z.strictObject({
  ...listingFields,
  price: listingFields.price.default(null),
  currency: listingFields.currency.default(DEFAULT_CURRENCY),
  attributes: listingFields.attributes.default({}),
});
export type CreateListingInput = z.infer<typeof createListingInputSchema>;

/** `PATCH /api/listings/:id`. Status changes go through their own endpoint. */
export const updateListingInputSchema = z
  .strictObject(listingFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');
export type UpdateListingInput = z.infer<typeof updateListingInputSchema>;

/** `PATCH /api/listings/:id/status`. */
export const changeListingStatusInputSchema = z.strictObject({ status: listingStatusSchema });
export type ChangeListingStatusInput = z.infer<typeof changeListingStatusInputSchema>;

/** A listing as returned by the API. Dates are ISO strings over JSON. */
export const listingSchema = z.object({
  id: z.uuid(),
  sellerId: z.string(),
  categoryId: z.number().int(),
  title: z.string(),
  description: z.string(),
  price: z.number().int().nullable(),
  currency: z.string(),
  city: z.string(),
  status: listingStatusSchema,
  attributes: listingAttributesSchema,
  /** Ordered by `position`; the first photo is the cover. */
  photos: z.array(listingPhotoSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Listing = z.infer<typeof listingSchema>;

/** `GET /api/me/listings`: the seller's own listings in any status, newest first. */
export const myListingsQuerySchema = paginationQuerySchema.extend({
  status: listingStatusSchema.optional(),
});
export type MyListingsQuery = z.infer<typeof myListingsQuerySchema>;

export const LISTING_SORTS = ['relevance', 'newest', 'oldest', 'price_asc', 'price_desc'] as const;
export const listingSortSchema = z.enum(LISTING_SORTS);
export type ListingSort = z.infer<typeof listingSortSchema>;

export const LISTING_SEARCH_QUERY_MAX = 200;

/** HTML forms send empty fields as `?city=`; treat those as "not set". */
const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

/**
 * `GET /api/listings`: public search over active listings. Values arrive as query-string strings.
 * - `q` — full-text search over title and description;
 * - `category` — category ID; a parent category includes all of its descendants;
 * - `city` — exact match, case-insensitive;
 * - `minPrice` / `maxPrice` — inclusive bounds in minor units; listings without a price are excluded
 *   when either bound is set;
 * - `currency` — restricts to one currency (price bounds are compared within it);
 * - `seller` — user ID: only that seller's listings (a public seller profile);
 * - `sort` — defaults to `relevance` when `q` is set, otherwise `newest`.
 */
export const listingSearchQuerySchema = paginationQuerySchema
  .extend({
    q: optionalParam(z.string().trim().max(LISTING_SEARCH_QUERY_MAX)),
    category: optionalParam(z.coerce.number().int().positive()),
    city: optionalParam(z.string().trim().max(100)),
    minPrice: optionalParam(z.coerce.number().int().min(0)),
    maxPrice: optionalParam(z.coerce.number().int().min(0)),
    currency: optionalParam(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code'),
    ),
    seller: optionalParam(z.uuid('Seller must be a user ID')),
    sort: optionalParam(listingSortSchema),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: 'minPrice must not exceed maxPrice',
    path: ['minPrice'],
  })
  .refine((v) => v.sort !== 'relevance' || v.q !== undefined, {
    message: 'Sorting by relevance requires a search query',
    path: ['sort'],
  });
export type ListingSearchQuery = z.infer<typeof listingSearchQuerySchema>;
