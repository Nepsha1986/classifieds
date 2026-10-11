import {
  categoryTreeSchema,
  listingPhotoSchema,
  listingSchema,
  paginatedSchema,
  profileSchema,
  type ChangeListingStatusInput,
  type CreateListingInput,
  type MyListingsQuery,
  type ReorderListingPhotosInput,
  type SignInInput,
  type SignUpInput,
  type UpdateListingInput,
  type UpdateProfileInput,
  PHOTO_UPLOAD_FIELD,
} from '@classifieds/shared';
import { z } from 'zod';
import { apiRequest } from './client';

const listingPageSchema = paginatedSchema(listingSchema);
const photosSchema = z.array(listingPhotoSchema);

/** better-auth endpoints (DECISIONS D12). The session cookie is set and cleared by the API. */
export const authApi = {
  signUp: (input: SignUpInput) =>
    apiRequest('/api/auth/sign-up/email', null, { method: 'POST', body: input }),
  signIn: (input: SignInInput) =>
    apiRequest('/api/auth/sign-in/email', null, { method: 'POST', body: input }),
  signOut: () => apiRequest('/api/auth/sign-out', null, { method: 'POST', body: {} }),
};

export const meApi = {
  get: () => apiRequest('/api/me', profileSchema),
  update: (input: UpdateProfileInput) =>
    apiRequest('/api/me', profileSchema, { method: 'PATCH', body: input }),
  listings: (query: Partial<MyListingsQuery> = {}) =>
    apiRequest('/api/me/listings', listingPageSchema, { query }),
};

export const categoriesApi = {
  tree: () => apiRequest('/api/categories', categoryTreeSchema),
};

export const listingsApi = {
  get: (id: string) => apiRequest(`/api/listings/${encodeURIComponent(id)}`, listingSchema),
  create: (input: CreateListingInput) =>
    apiRequest('/api/listings', listingSchema, { method: 'POST', body: input }),
  update: (id: string, input: UpdateListingInput) =>
    apiRequest(`/api/listings/${encodeURIComponent(id)}`, listingSchema, { method: 'PATCH', body: input }),
  remove: (id: string) => apiRequest(`/api/listings/${encodeURIComponent(id)}`, null, { method: 'DELETE' }),
  changeStatus: (id: string, input: ChangeListingStatusInput) =>
    apiRequest(`/api/listings/${encodeURIComponent(id)}/status`, listingSchema, {
      method: 'PATCH',
      body: input,
    }),
  uploadPhotos: (id: string, files: readonly File[]) => {
    const form = new FormData();
    for (const file of files) form.append(PHOTO_UPLOAD_FIELD, file);
    return apiRequest(`/api/listings/${encodeURIComponent(id)}/photos`, photosSchema, {
      method: 'POST',
      body: form,
    });
  },
  reorderPhotos: (id: string, input: ReorderListingPhotosInput) =>
    apiRequest(`/api/listings/${encodeURIComponent(id)}/photos/order`, photosSchema, {
      method: 'PUT',
      body: input,
    }),
  deletePhoto: (id: string, photoId: string) =>
    apiRequest(`/api/listings/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, null, {
      method: 'DELETE',
    }),
};
