import { z } from 'zod';

export const LISTING_STATUSES = ['active', 'paused', 'sold'] as const;

export const listingStatusSchema = z.enum(LISTING_STATUSES);
export type ListingStatus = z.infer<typeof listingStatusSchema>;
