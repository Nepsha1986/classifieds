import { listingSchema } from '@classifieds/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import {
  changeListingStatus,
  createListing,
  deleteListing,
  getListing,
  updateListing,
} from '../src/services/listings.service.js';
import { seededCategories, signUpAgent } from './helpers.js';

const app = createApp();
let cats: Awaited<ReturnType<typeof seededCategories>>;
let owner: string;
let stranger: string;

beforeAll(async () => {
  cats = await seededCategories();
  owner = (await signUpAgent(app)).user.id;
  stranger = (await signUpAgent(app)).user.id;
});

afterAll(async () => {
  await pool.end();
});

const input = () => ({
  title: 'Toyota Corolla 2015',
  description: 'One owner',
  price: 12_000_00, // 12 000.00 USD in cents
  currency: 'USD',
  city: 'Kyiv',
  categoryId: cats.cars,
  attributes: { mileage: 120000 },
});

describe('listings service', () => {
  it('creates an active listing owned by the seller', async () => {
    const listing = await createListing(owner, input());
    expect(listingSchema.parse(listing)).toMatchObject({
      sellerId: owner,
      status: 'active',
      price: 1_200_000,
    });
    expect(await getListing(listing.id)).toEqual(listing);
  });

  it('rejects unknown and non-leaf categories', async () => {
    await expect(createListing(owner, { ...input(), categoryId: 999999 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(createListing(owner, { ...input(), categoryId: cats.transport })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('enforces ownership on writes', async () => {
    const { id } = await createListing(owner, input());
    await expect(updateListing(id, stranger, { title: 'Mine now' })).rejects.toMatchObject({ status: 403 });
    await expect(changeListingStatus(id, stranger, { status: 'sold' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(deleteListing(id, stranger)).rejects.toMatchObject({ status: 403 });
    const updated = await updateListing(id, owner, { title: 'Toyota Corolla', categoryId: cats.phones });
    expect(updated).toMatchObject({ title: 'Toyota Corolla', categoryId: cats.phones });
  });

  it('hides paused listings from everyone but the seller', async () => {
    const { id } = await createListing(owner, input());
    await changeListingStatus(id, owner, { status: 'paused' });
    await expect(getListing(id)).rejects.toMatchObject({ status: 404 });
    await expect(getListing(id, stranger)).rejects.toMatchObject({ status: 404 });
    expect((await getListing(id, owner)).status).toBe('paused');
  });

  it('applies status transitions; sold is final and read-only', async () => {
    const { id } = await createListing(owner, input());
    expect((await changeListingStatus(id, owner, { status: 'sold' })).status).toBe('sold');
    expect((await changeListingStatus(id, owner, { status: 'sold' })).status).toBe('sold');
    await expect(changeListingStatus(id, owner, { status: 'active' })).rejects.toMatchObject({ status: 409 });
    await expect(updateListing(id, owner, { price: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await getListing(id)).status).toBe('sold');
  });

  it('deletes a listing; unknown or malformed IDs are 404', async () => {
    const { id } = await createListing(owner, input());
    await deleteListing(id, owner);
    await expect(getListing(id)).rejects.toMatchObject({ status: 404 });
    await expect(deleteListing(id, owner)).rejects.toMatchObject({ status: 404 });
    await expect(getListing('not-a-uuid')).rejects.toMatchObject({ status: 404 });
  });
});
