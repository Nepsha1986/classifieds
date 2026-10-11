import {
  categoryTreeSchema,
  listingSchema,
  paginatedSchema,
  publicUserSchema,
  type ListingSearchQuery,
} from '@classifieds/shared';
import { apiGet, apiGetOrNull } from './api';

const listingPageSchema = paginatedSchema(listingSchema);

/** Categories change only on deploy (DECISIONS D16); the API lets clients cache them for 5 minutes. */
const CATEGORIES_REVALIDATE_SECONDS = 300;

export const api = {
  categories: () =>
    apiGet('/api/categories', categoryTreeSchema, { revalidate: CATEGORIES_REVALIDATE_SECONDS }),
  searchListings: (query: Partial<ListingSearchQuery> = {}) =>
    apiGet('/api/listings', listingPageSchema, { query }),
  listing: (id: string) => apiGetOrNull(`/api/listings/${encodeURIComponent(id)}`, listingSchema),
  user: (id: string) => apiGetOrNull(`/api/users/${encodeURIComponent(id)}`, publicUserSchema),
};
