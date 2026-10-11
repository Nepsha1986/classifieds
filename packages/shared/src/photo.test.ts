import { describe, expect, it } from 'vitest';
import { isPhotoMimeType, listingPhotoSchema, reorderListingPhotosInputSchema } from './photo.js';

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe('isPhotoMimeType', () => {
  it('accepts JPEG, PNG and WebP only', () => {
    expect(['image/jpeg', 'image/png', 'image/webp'].every(isPhotoMimeType)).toBe(true);
    expect(isPhotoMimeType('image/gif')).toBe(false);
    expect(isPhotoMimeType('text/plain')).toBe(false);
  });
});

describe('listingPhotoSchema', () => {
  it('requires an API-relative upload URL', () => {
    const photo = {
      id: id(1),
      url: '/uploads/listings/a.png',
      position: 0,
      createdAt: new Date().toISOString(),
    };
    expect(listingPhotoSchema.safeParse(photo).success).toBe(true);
    expect(listingPhotoSchema.safeParse({ ...photo, url: 'https://evil.example/a.png' }).success).toBe(false);
  });
});

describe('reorderListingPhotosInputSchema', () => {
  it('accepts unique UUIDs (an empty list for a listing without photos)', () => {
    expect(reorderListingPhotosInputSchema.parse({ photoIds: [id(2), id(1)] }).photoIds).toEqual([
      id(2),
      id(1),
    ]);
    expect(reorderListingPhotosInputSchema.safeParse({ photoIds: [] }).success).toBe(true);
  });

  it.each([
    ['duplicates', { photoIds: [id(1), id(1)] }],
    ['non-UUIDs', { photoIds: ['abc'] }],
    ['too many', { photoIds: Array.from({ length: 11 }, () => crypto.randomUUID()) }],
    ['unknown keys', { photoIds: [id(1)], extra: true }],
    ['missing list', {}],
  ])('rejects %s', (_name, input) => {
    expect(reorderListingPhotosInputSchema.safeParse(input).success).toBe(false);
  });
});
