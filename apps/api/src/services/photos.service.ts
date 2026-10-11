import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import {
  type ListingPhoto,
  PHOTO_MAX_PER_LISTING,
  PHOTO_MIME_TYPES,
  type ReorderListingPhotosInput,
} from '@classifieds/shared';
import { and, asc, count, eq, inArray, max, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { listingPhotos } from '../db/schema.js';
import { HttpError, badRequest, conflict, notFound } from '../lib/http-error.js';
import {
  LISTING_PHOTOS_DIR,
  PHOTO_EXTENSIONS,
  detectImageType,
  listingPhotoPath,
  listingPhotoUrl,
} from '../lib/uploads.js';
import { type Executor, type Transaction, isListingId, lockOwnListing } from './listing-access.js';

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

const photoOrder = [asc(listingPhotos.position), asc(listingPhotos.createdAt), asc(listingPhotos.id)];

export async function listListingPhotos(listingId: string, executor: Executor = db) {
  const rows = await executor
    .select()
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId))
    .orderBy(...photoOrder);
  return rows.map(toListingPhoto);
}

/** Photos of many listings in one query, grouped by listing ID and ordered. */
export async function photosByListing(
  listingIds: readonly string[],
  executor: Executor = db,
): Promise<Map<string, ListingPhoto[]>> {
  const grouped = new Map<string, ListingPhoto[]>();
  if (listingIds.length === 0) return grouped;
  const rows = await executor
    .select()
    .from(listingPhotos)
    .where(inArray(listingPhotos.listingId, [...listingIds]))
    .orderBy(...photoOrder);
  for (const row of rows) {
    const list = grouped.get(row.listingId) ?? [];
    list.push(toListingPhoto(row));
    grouped.set(row.listingId, list);
  }
  return grouped;
}

/** Renumbers a listing's photos to 0..n-1 keeping their order, so positions stay contiguous. */
async function compactPositions(tx: Transaction, listingId: string) {
  await tx.execute(sql`
    UPDATE ${listingPhotos} AS p SET position = o.rn - 1
    FROM (
      SELECT id, row_number() OVER (ORDER BY position, created_at, id) AS rn
      FROM ${listingPhotos} WHERE listing_id = ${listingId}
    ) AS o
    WHERE p.id = o.id AND p.position <> o.rn - 1
  `);
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

const photoNotFound = () => notFound('Photo not found');

/** Removes a photo (row and file); the remaining photos keep their order. */
export async function deleteListingPhoto(listingId: string, photoId: string, userId: string): Promise<void> {
  const fileName = await db.transaction(async (tx) => {
    await lockEditableListing(tx, listingId, userId);
    if (!isListingId(photoId)) throw photoNotFound();
    const [row] = await tx
      .delete(listingPhotos)
      .where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId)))
      .returning({ fileName: listingPhotos.fileName });
    if (!row) throw photoNotFound();
    await compactPositions(tx, listingId);
    return row.fileName;
  });
  // After the commit: a failed delete must not leave a row pointing at a missing file.
  await removeFiles([listingPhotoPath(fileName)]);
}

/** Sets the photo order; `photoIds` must list every photo of the listing exactly once. */
export async function reorderListingPhotos(
  listingId: string,
  userId: string,
  { photoIds }: ReorderListingPhotosInput,
): Promise<ListingPhoto[]> {
  return db.transaction(async (tx) => {
    await lockEditableListing(tx, listingId, userId);
    const current = await tx
      .select({ id: listingPhotos.id })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, listingId));
    const currentIds = new Set(current.map((p) => p.id));
    if (photoIds.length !== currentIds.size || !photoIds.every((id) => currentIds.has(id))) {
      throw badRequest('photoIds must list every photo of the listing exactly once', {
        expected: [...currentIds],
      });
    }
    if (photoIds.length > 0) {
      const ids = sql.join(
        photoIds.map((id) => sql`${id}`),
        sql`, `,
      );
      await tx.execute(sql`
        UPDATE ${listingPhotos} AS p SET position = o.ord - 1
        FROM unnest(ARRAY[${ids}]::uuid[]) WITH ORDINALITY AS o(id, ord)
        WHERE p.id = o.id AND p.listing_id = ${listingId}
      `);
    }
    return listListingPhotos(listingId, tx);
  });
}

/** Best-effort removal; a missing file is not an error. */
export async function removeFiles(paths: readonly string[]): Promise<void> {
  await Promise.all(paths.map((p) => rm(p, { force: true }).catch((err) => console.error(err))));
}
