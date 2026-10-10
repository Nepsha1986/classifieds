import { z } from 'zod';
import { paginationQuerySchema } from './pagination.js';

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
  title: z.string().trim().min(3).max(LISTING_TITLE_MAX),
  description: z.string().trim().min(1).max(LISTING_DESCRIPTION_MAX),
  /** Minor currency units (kopecks/cents); `null` means "price on request". */
  price: z.number().int().min(0).max(2_000_000_000).nullable(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code'),
  city: z.string().trim().min(1).max(100),
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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Listing = z.infer<typeof listingSchema>;

/** `GET /api/me/listings`: the seller's own listings in any status, newest first. */
export const myListingsQuerySchema = paginationQuerySchema.extend({
  status: listingStatusSchema.optional(),
});
export type MyListingsQuery = z.infer<typeof myListingsQuerySchema>;
