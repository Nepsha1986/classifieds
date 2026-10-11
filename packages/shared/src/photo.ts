import { z } from 'zod';

/** Multipart field name for photo uploads (`POST /api/listings/:id/photos`). */
export const PHOTO_UPLOAD_FIELD = 'photos';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Maximum photos per listing (across all uploads); also the most one request can carry. */
export const PHOTO_MAX_PER_LISTING = 10;
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

export function isPhotoMimeType(value: string): value is PhotoMimeType {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(value);
}

/** A listing photo as returned by the API. `url` is a path on the API server (`/uploads/...`). */
export const listingPhotoSchema = z.object({
  id: z.uuid(),
  url: z.string().startsWith('/uploads/'),
  position: z.number().int().min(0),
  createdAt: z.iso.datetime(),
});
export type ListingPhoto = z.infer<typeof listingPhotoSchema>;

/**
 * `PUT /api/listings/:id/photos/order`: every photo of the listing exactly once, in the new order
 * (the first one becomes the cover).
 */
export const reorderListingPhotosInputSchema = z.strictObject({
  photoIds: z
    .array(z.uuid())
    .max(PHOTO_MAX_PER_LISTING)
    .refine((ids) => new Set(ids).size === ids.length, 'Photo IDs must be unique'),
});
export type ReorderListingPhotosInput = z.infer<typeof reorderListingPhotosInputSchema>;
