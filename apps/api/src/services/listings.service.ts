import {
  type ChangeListingStatusInput,
  type CreateListingInput,
  type Listing,
  type ListingStatus,
  type MyListingsQuery,
  type Paginated,
  type UpdateListingInput,
  canChangeListingStatus,
} from '@classifieds/shared';
import { and, count, desc, eq, exists } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, db } from '../db/client.js';
import { categories, listings } from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http-error.js';

type ListingRow = typeof listings.$inferSelect;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Statuses anyone can see; a paused listing is visible only to its seller. */
const PUBLIC_STATUSES: readonly ListingStatus[] = ['active', 'sold'];

export function toListing(row: ListingRow): Listing {
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const listingNotFound = () => notFound('Listing not found');

/** Listing IDs are UUIDs; anything else cannot exist (and would make Postgres reject the cast). */
function isListingId(id: string) {
  return z.uuid().safeParse(id).success;
}

/** A listing must be filed under an existing leaf category (e.g. "Cars", not "Transport"). */
async function assertLeafCategory(executor: Database | Transaction, categoryId: number) {
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

/**
 * Loads a listing for a write by its seller: 404 if it does not exist, 403 if it belongs to someone
 * else. The row is locked until the transaction ends so concurrent writes cannot interleave.
 */
async function lockOwnListing(tx: Transaction, id: string, userId: string) {
  if (!isListingId(id)) throw listingNotFound();
  const [row] = await tx.select().from(listings).where(eq(listings.id, id)).for('update');
  if (!row) throw listingNotFound();
  if (row.sellerId !== userId) throw forbidden('You can only manage your own listings');
  return row;
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
  return toListing(row);
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
    return toListing(row!);
  });
}

export async function deleteListing(id: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOwnListing(tx, id, userId);
    await tx.delete(listings).where(eq(listings.id, id));
  });
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
    if (current.status === status) return toListing(current);
    const [row] = await tx
      .update(listings)
      .set({ status })
      .where(and(eq(listings.id, id), eq(listings.sellerId, userId)))
      .returning();
    return toListing(row!);
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
  return { items: rows.map(toListing), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
