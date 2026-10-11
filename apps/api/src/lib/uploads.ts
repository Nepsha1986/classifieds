import { open } from 'node:fs/promises';
import path from 'node:path';
import type { PhotoMimeType } from '@classifieds/shared';
import { config } from '../config.js';

/** Multer writes incoming files here; they move to `listingPhotos` only after validation. */
export const UPLOAD_TMP_DIR = path.join(config.UPLOAD_DIR, 'tmp');
/** Accepted listing photos, served publicly under `LISTING_PHOTOS_URL`. */
export const LISTING_PHOTOS_DIR = path.join(config.UPLOAD_DIR, 'listings');
export const LISTING_PHOTOS_URL = '/uploads/listings';

export const PHOTO_EXTENSIONS: Record<PhotoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const listingPhotoPath = (fileName: string) => path.join(LISTING_PHOTOS_DIR, fileName);
export const listingPhotoUrl = (fileName: string) => `${LISTING_PHOTOS_URL}/${fileName}`;

/**
 * Detects JPEG, PNG and WebP by their magic bytes. The client-sent Content-Type is only a hint, so the
 * stored file's real format decides whether it is accepted.
 */
export async function detectImageType(filePath: string): Promise<PhotoMimeType | undefined> {
  const file = await open(filePath, 'r');
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(12), 0, 12, 0);
    return detectImageTypeFromBytes(buffer.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}

export function detectImageTypeFromBytes(bytes: Uint8Array): PhotoMimeType | undefined {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // RIFF....WEBP
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return undefined;
}
