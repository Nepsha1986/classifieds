import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import { type ListingPhoto, PHOTO_MAX_PER_LISTING, PHOTO_MIME_TYPES } from '@classifieds/shared';
import { asc, count, eq, max } from 'drizzle-orm';
import { db } from '../db/client.js';
import { listingPhotos } from '../db/schema.js';
import { HttpError, badRequest, conflict } from '../lib/http-error.js';
import {
  LISTING_PHOTOS_DIR,
  PHOTO_EXTENSIONS,
  detectImageType,
  listingPhotoPath,
  listingPhotoUrl,
} from '../lib/uploads.js';
import { type Transaction, lockOwnListing } from './listings.service.js';

type PhotoRow = typeof listingPhotos.$inferSelect;

/** A file Multer has written to the temp upload dir. */
export type UploadedFile = { path: string; originalname: string };

export function toListingPhoto(row: PhotoRow): ListingPhoto {
  return {
    id: row.id,
    url: listingPhotoUrl(row.fileName),
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Photos can be changed only by the seller, and not on a sold listing (sold listings are read-only). */
async function lockEditableListing(tx: Transaction, listingId: string, userId: string) {
  const listing = await lockOwnListing(tx, listingId, userId);
  if (listing.status === 'sold') throw conflict('Photos of a sold listing cannot be changed');
  return listing;
}

/**
 * Cheap pre-check before the request body is read, so a stranger's upload is rejected before any
 * bytes reach the disk. `addListingPhotos` re-checks everything under a lock.
 */
export async function assertCanEditPhotos(listingId: string, userId: string): Promise<void> {
  await db.transaction((tx) => lockEditableListing(tx, listingId, userId));
}

export async function listListingPhotos(listingId: string, executor: Transaction | typeof db = db) {
  const rows = await executor
    .select()
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId))
    .orderBy(asc(listingPhotos.position), asc(listingPhotos.createdAt));
  return rows.map(toListingPhoto);
}

/**
 * Validates uploaded files by their real format, moves them into the photo dir and appends them after
 * the listing's existing photos. Returns all photos of the listing in order. The temp files are always
 * removed; moved files are removed again if the database write fails.
 */
export async function addListingPhotos(
  listingId: string,
  userId: string,
  files: readonly UploadedFile[],
): Promise<ListingPhoto[]> {
  const moved: string[] = [];
  try {
    if (files.length === 0) throw badRequest('No photos uploaded');

    const types = await Promise.all(files.map((f) => detectImageType(f.path)));
    const invalid = files.filter((_, i) => types[i] === undefined).map((f) => f.originalname);
    if (invalid.length > 0) {
      throw new HttpError(415, `Photos must be ${PHOTO_MIME_TYPES.join(', ')}`, { invalid });
    }

    return await db.transaction(async (tx) => {
      await lockEditableListing(tx, listingId, userId);
      const [stats] = await tx
        .select({ total: count(), lastPosition: max(listingPhotos.position) })
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listingId));
      const existing = stats?.total ?? 0;
      if (existing + files.length > PHOTO_MAX_PER_LISTING) {
        throw conflict(
          `A listing can have at most ${PHOTO_MAX_PER_LISTING} photos; it has ${existing}, ` +
            `${files.length} more do not fit`,
        );
      }

      await mkdir(LISTING_PHOTOS_DIR, { recursive: true });
      const firstPosition = (stats?.lastPosition ?? -1) + 1;
      const values = [];
      for (const [i, file] of files.entries()) {
        const fileName = `${randomUUID()}.${PHOTO_EXTENSIONS[types[i]!]}`;
        await rename(file.path, listingPhotoPath(fileName));
        moved.push(listingPhotoPath(fileName));
        values.push({ listingId, fileName, position: firstPosition + i });
      }
      await tx.insert(listingPhotos).values(values);
      return listListingPhotos(listingId, tx);
    });
  } catch (err) {
    await removeFiles(moved);
    throw err;
  } finally {
    await removeFiles(files.map((f) => f.path));
  }
}

/** Best-effort removal; a missing file is not an error. */
export async function removeFiles(paths: readonly string[]): Promise<void> {
  await Promise.all(paths.map((p) => rm(p, { force: true }).catch((err) => console.error(err))));
}
