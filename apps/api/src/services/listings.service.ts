import {
  type ChangeListingStatusInput,
  type ListingPhoto,
  type CreateListingInput,
  type Listing,
  type ListingStatus,
  type MyListingsQuery,
  type Paginated,
  type UpdateListingInput,
  canChangeListingStatus,
} from '@classifieds/shared';
import { and, count, desc, eq, exists } from 'drizzle-orm';
import { db } from '../db/client.js';
import { categories, listingPhotos, listings } from '../db/schema.js';
import { badRequest, conflict } from '../lib/http-error.js';
import { listingPhotoPath } from '../lib/uploads.js';
import { type Executor, isListingId, listingNotFound, lockOwnListing } from './listing-access.js';
import { photosByListing, removeFiles } from './photos.service.js';

type ListingRow = typeof listings.$inferSelect;

/** Statuses anyone can see; a paused listing is visible only to its seller. */
const PUBLIC_STATUSES: readonly ListingStatus[] = ['active', 'sold'];

export function toListing(row: ListingRow, photos: ListingPhoto[] = []): Listing {
  return {
    id: row.id,
    sellerId: row.sellerId,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: row.currency,
    city: row.city,
    status: row.status,
    attributes: row.attributes as Listing['attributes'],
    photos,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Converts rows to API listings, loading their photos in one query. */
async function withPhotos(rows: ListingRow[], executor: Executor = db): Promise<Listing[]> {
  const photos = await photosByListing(
    rows.map((r) => r.id),
    executor,
  );
  return rows.map((row) => toListing(row, photos.get(row.id) ?? []));
}

async function withPhotosOne(row: ListingRow, executor: Executor = db): Promise<Listing> {
  const [listing] = await withPhotos([row], executor);
  return listing!;
}

/** A listing must be filed under an existing leaf category (e.g. "Cars", not "Transport"). */
async function assertLeafCategory(executor: Executor, categoryId: number) {
  const child = executor
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, categoryId));
  const [category] = await executor
    .select({ id: categories.id, hasChildren: exists(child) })
    .from(categories)
    .where(eq(categories.id, categoryId));
  if (!category) throw badRequest('Unknown category', { categoryId });
  if (category.hasChildren) throw badRequest('Choose a subcategory', { categoryId });
}

export async function createListing(sellerId: string, input: CreateListingInput): Promise<Listing> {
  await assertLeafCategory(db, input.categoryId);
  const [row] = await db
    .insert(listings)
    .values({ ...input, sellerId, status: 'active' })
    .returning();
  return toListing(row!);
}

/** Public read. Paused listings are visible only to their seller (`viewerId`). */
export async function getListing(id: string, viewerId?: string): Promise<Listing> {
  if (!isListingId(id)) throw listingNotFound();
  const [row] = await db.select().from(listings).where(eq(listings.id, id));
  if (!row) throw listingNotFound();
  if (!PUBLIC_STATUSES.includes(row.status) && row.sellerId !== viewerId) throw listingNotFound();
  return withPhotosOne(row);
}

/** Edits the listing's content. Sold listings are read-only. */
export async function updateListing(id: string, userId: string, input: UpdateListingInput): Promise<Listing> {
  return db.transaction(async (tx) => {
    const current = await lockOwnListing(tx, id, userId);
    if (current.status === 'sold') throw conflict('A sold listing cannot be edited');
    if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
      await assertLeafCategory(tx, input.categoryId);
    }
    const [row] = await tx.update(listings).set(input).where(eq(listings.id, id)).returning();
    return withPhotosOne(row!, tx);
  });
}

/** Deletes the listing with its photos; the photo files are removed after the commit. */
export async function deleteListing(id: string, userId: string): Promise<void> {
  const fileNames = await db.transaction(async (tx) => {
    await lockOwnListing(tx, id, userId);
    // Photo rows go with the listing (ON DELETE CASCADE); their file names are needed for the disk.
    const photos = await tx
      .select({ fileName: listingPhotos.fileName })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, id));
    await tx.delete(listings).where(eq(listings.id, id));
    return photos.map((p) => p.fileName);
  });
  await removeFiles(fileNames.map(listingPhotoPath));
}

export async function changeListingStatus(
  id: string,
  userId: string,
  { status }: ChangeListingStatusInput,
): Promise<Listing> {
  return db.transaction(async (tx) => {
    const current = await lockOwnListing(tx, id, userId);
    if (!canChangeListingStatus(current.status, status)) {
      throw conflict(`Cannot change status from ${current.status} to ${status}`);
    }
    if (current.status === status) return withPhotosOne(current, tx);
    const [row] = await tx
      .update(listings)
      .set({ status })
      .where(and(eq(listings.id, id), eq(listings.sellerId, userId)))
      .returning();
    return withPhotosOne(row!, tx);
  });
}

/** The seller's own listings in any status (optionally one status), newest first. */
export async function listOwnListings(
  sellerId: string,
  { page, pageSize, status }: MyListingsQuery,
): Promise<Paginated<Listing>> {
  const where = and(eq(listings.sellerId, sellerId), status ? eq(listings.status, status) : undefined);
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(listings)
      .where(where)
      .orderBy(desc(listings.createdAt), desc(listings.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(listings).where(where),
  ]);
  const total = totals?.total ?? 0;
  return { items: await withPhotos(rows), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
