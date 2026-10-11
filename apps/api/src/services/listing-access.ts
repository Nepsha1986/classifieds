import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import { listings } from '../db/schema.js';
import { forbidden, notFound } from '../lib/http-error.js';

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Either the pool or an open transaction. */
export type Executor = Database | Transaction;

export const listingNotFound = () => notFound('Listing not found');

/** Listing IDs are UUIDs; anything else cannot exist (and would make Postgres reject the cast). */
export function isListingId(id: string) {
  return z.uuid().safeParse(id).success;
}

/**
 * Loads a listing for a write by its seller: 404 if it does not exist, 403 if it belongs to someone
 * else. The row is locked until the transaction ends so concurrent writes cannot interleave.
 */
export async function lockOwnListing(tx: Transaction, id: string, userId: string) {
  if (!isListingId(id)) throw listingNotFound();
  const [row] = await tx.select().from(listings).where(eq(listings.id, id)).for('update');
  if (!row) throw listingNotFound();
  if (row.sellerId !== userId) throw forbidden('You can only manage your own listings');
  return row;
}
