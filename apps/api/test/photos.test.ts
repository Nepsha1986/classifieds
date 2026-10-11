import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  type Listing,
  type ListingPhoto,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_LISTING,
  listingPhotoSchema,
  listingSchema,
} from '@classifieds/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { LISTING_PHOTOS_DIR, UPLOAD_TMP_DIR } from '../src/lib/uploads.js';
import { pngBytes, seededCategories, signUpAgent } from './helpers.js';

const app = createApp();
type Agent = Awaited<ReturnType<typeof signUpAgent>>['agent'];

let cats: Awaited<ReturnType<typeof seededCategories>>;
let seller: Agent;
let other: Agent;

beforeAll(async () => {
  cats = await seededCategories();
  seller = (await signUpAgent(app)).agent;
  other = (await signUpAgent(app)).agent;
});

afterAll(async () => {
  await pool.end();
});

const PNG = pngBytes();
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEADER = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1');

async function createListing(agent: Agent = seller): Promise<Listing> {
  const res = await agent.post('/api/listings').send({
    title: 'Photo test listing',
    description: 'Has photos',
    city: 'Kyiv',
    categoryId: cats.cars,
  });
  expect(res.status).toBe(201);
  return res.body as Listing;
}

type Upload = { body?: Buffer; filename?: string; contentType?: string; field?: string };

function upload(agent: Agent | ReturnType<typeof request>, listingId: string, files: Upload[]) {
  let req = agent.post(`/api/listings/${listingId}/photos`);
  for (const f of files) {
    req = req.attach(f.field ?? 'photos', f.body ?? PNG, {
      filename: f.filename ?? 'photo.png',
      contentType: f.contentType ?? 'image/png',
    });
  }
  return req;
}

const fileOf = (photo: ListingPhoto) => path.join(LISTING_PHOTOS_DIR, path.basename(photo.url));
const photoFileCount = async () =>
  existsSync(LISTING_PHOTOS_DIR) ? (await readdir(LISTING_PHOTOS_DIR)).length : 0;
const tempFileCount = async () => (existsSync(UPLOAD_TMP_DIR) ? (await readdir(UPLOAD_TMP_DIR)).length : 0);

describe('POST /api/listings/:id/photos', () => {
  it('stores a valid image, returns the photos and serves the file by URL', async () => {
    const listing = await createListing();
    const res = await upload(seller, listing.id, [{}]);
    expect(res.status).toBe(201);
    const photos = listingPhotoSchema.array().parse(res.body);
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ position: 0 });
    expect(photos[0]!.url).toMatch(/^\/uploads\/listings\/[0-9a-f-]{36}\.png$/);

    const download = await request(app).get(photos[0]!.url).buffer(true);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['cache-control']).toContain('immutable');
    expect(Buffer.compare(download.body as Buffer, PNG)).toBe(0);
  });

  it('accepts JPEG and WebP, names files by their real format and appends in order', async () => {
    const listing = await createListing();
    await upload(seller, listing.id, [{}]).expect(201);
    const res = await upload(seller, listing.id, [
      { body: JPEG_HEADER, filename: 'a.jpeg', contentType: 'image/jpeg' },
      // Declared as PNG, really WebP: the stored extension follows the bytes.
      { body: WEBP_HEADER, filename: 'b.png', contentType: 'image/png' },
    ]);
    expect(res.status).toBe(201);
    const photos = res.body as ListingPhoto[];
    expect(photos.map((p) => p.position)).toEqual([0, 1, 2]);
    expect(photos.map((p) => path.extname(p.url))).toEqual(['.png', '.jpg', '.webp']);
  });

  it('includes photos in the listing and in /api/me/listings', async () => {
    const listing = await createListing();
    const uploaded = (await upload(seller, listing.id, [{}, {}]).expect(201)).body as ListingPhoto[];

    const got = await request(app).get(`/api/listings/${listing.id}`);
    expect(listingSchema.parse(got.body).photos).toEqual(uploaded);

    const mine = await seller.get('/api/me/listings').query({ pageSize: 100 });
    const item = (mine.body.items as Listing[]).find((l) => l.id === listing.id)!;
    expect(item.photos).toEqual(uploaded);
  });

  it('rejects a declared non-image type with 415', async () => {
    const listing = await createListing();
    const res = await upload(seller, listing.id, [
      { body: Buffer.from('hello'), filename: 'a.txt', contentType: 'text/plain' },
    ]);
    expect(res.status).toBe(415);
    expect(res.body.details.allowed).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('rejects a file whose bytes are not an image even if it claims to be one (415)', async () => {
    const listing = await createListing();
    const before = await photoFileCount();
    const res = await upload(seller, listing.id, [{}, { body: Buffer.from('<svg/>'), filename: 'evil.png' }]);
    expect(res.status).toBe(415);
    expect(res.body.details.invalid).toEqual(['evil.png']);
    // All-or-nothing: the valid file of the same request is not kept either.
    expect(await photoFileCount()).toBe(before);
    const got = await request(app).get(`/api/listings/${listing.id}`);
    expect(got.body.photos).toEqual([]);
  });

  it('rejects a file over the size limit with 413', async () => {
    const listing = await createListing();
    const big = Buffer.concat([JPEG_HEADER, Buffer.alloc(PHOTO_MAX_BYTES)]);
    const res = await upload(seller, listing.id, [
      { body: big, filename: 'big.jpg', contentType: 'image/jpeg' },
    ]);
    expect(res.status).toBe(413);
  });

  it('accepts a file of exactly the size limit', async () => {
    const listing = await createListing();
    const exact = Buffer.concat([JPEG_HEADER, Buffer.alloc(PHOTO_MAX_BYTES - JPEG_HEADER.length)]);
    const res = await upload(seller, listing.id, [
      { body: exact, filename: 'x.jpg', contentType: 'image/jpeg' },
    ]);
    expect(res.status).toBe(201);
  });

  it('limits photos per request (400) and per listing in total (409)', async () => {
    const listing = await createListing();
    const tooMany = Array.from({ length: PHOTO_MAX_PER_LISTING + 1 }, () => ({}));
    expect((await upload(seller, listing.id, tooMany)).status).toBe(400);

    await upload(
      seller,
      listing.id,
      Array.from({ length: PHOTO_MAX_PER_LISTING - 1 }, () => ({})),
    ).expect(201);
    expect((await upload(seller, listing.id, [{}, {}])).status).toBe(409);
    const last = await upload(seller, listing.id, [{}]);
    expect(last.status).toBe(201);
    expect(last.body).toHaveLength(PHOTO_MAX_PER_LISTING);
    expect((await upload(seller, listing.id, [{}])).status).toBe(409);
  });

  it.each([
    ['no files', [] as Upload[], undefined],
    ['the wrong field name', [{ field: 'photo' }], undefined],
  ])('rejects %s with 400', async (_name, files) => {
    const listing = await createListing();
    expect((await upload(seller, listing.id, files)).status).toBe(400);
  });

  it('rejects text fields with 400', async () => {
    const listing = await createListing();
    const res = await seller
      .post(`/api/listings/${listing.id}/photos`)
      .field('caption', 'hi')
      .attach('photos', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('requires auth (401) and ownership (403), and writes nothing for strangers', async () => {
    const listing = await createListing();
    const before = await photoFileCount();
    expect((await upload(request(app), listing.id, [{}])).status).toBe(401);
    const res = await upload(other, listing.id, [{}]);
    expect(res.status).toBe(403);
    expect(await photoFileCount()).toBe(before);
  });

  it('returns 404 for unknown and malformed listing IDs', async () => {
    expect((await upload(seller, crypto.randomUUID(), [{}])).status).toBe(404);
    expect((await upload(seller, 'not-a-uuid', [{}])).status).toBe(404);
  });

  it('rejects uploads to a sold listing with 409', async () => {
    const listing = await createListing();
    await seller.patch(`/api/listings/${listing.id}/status`).send({ status: 'sold' }).expect(200);
    expect((await upload(seller, listing.id, [{}])).status).toBe(409);
  });

  it('allows uploads to a paused listing', async () => {
    const listing = await createListing();
    await seller.patch(`/api/listings/${listing.id}/status`).send({ status: 'paused' }).expect(200);
    expect((await upload(seller, listing.id, [{}])).status).toBe(201);
  });
});

describe('PUT /api/listings/:id/photos/order', () => {
  it('reorders photos; the first becomes the cover', async () => {
    const listing = await createListing();
    const photos = (await upload(seller, listing.id, [{}, {}, {}]).expect(201)).body as ListingPhoto[];
    const order = [photos[2]!.id, photos[0]!.id, photos[1]!.id];

    const res = await seller.put(`/api/listings/${listing.id}/photos/order`).send({ photoIds: order });
    expect(res.status).toBe(200);
    expect((res.body as ListingPhoto[]).map((p) => p.id)).toEqual(order);
    expect((res.body as ListingPhoto[]).map((p) => p.position)).toEqual([0, 1, 2]);

    const got = await request(app).get(`/api/listings/${listing.id}`);
    expect((got.body as Listing).photos.map((p) => p.id)).toEqual(order);
  });

  it('requires every photo exactly once (400) and ownership (403)', async () => {
    const listing = await createListing();
    const photos = (await upload(seller, listing.id, [{}, {}]).expect(201)).body as ListingPhoto[];
    const path_ = `/api/listings/${listing.id}/photos/order`;

    expect((await seller.put(path_).send({ photoIds: [photos[0]!.id] })).status).toBe(400);
    expect((await seller.put(path_).send({ photoIds: [photos[0]!.id, photos[0]!.id] })).status).toBe(400);
    expect((await seller.put(path_).send({ photoIds: [photos[0]!.id, crypto.randomUUID()] })).status).toBe(
      400,
    );
    expect((await seller.put(path_).send({})).status).toBe(400);
    const reversed = { photoIds: [photos[1]!.id, photos[0]!.id] };
    expect((await other.put(path_).send(reversed)).status).toBe(403);
    expect((await request(app).put(path_).send(reversed)).status).toBe(401);
  });
});

describe('DELETE /api/listings/:id/photos/:photoId', () => {
  it('removes the row and the file, and keeps positions contiguous', async () => {
    const listing = await createListing();
    const photos = (await upload(seller, listing.id, [{}, {}, {}]).expect(201)).body as ListingPhoto[];
    const victim = photos[1]!;
    expect(existsSync(fileOf(victim))).toBe(true);

    await seller.delete(`/api/listings/${listing.id}/photos/${victim.id}`).expect(204);
    expect(existsSync(fileOf(victim))).toBe(false);
    expect((await request(app).get(victim.url)).status).toBe(404);

    const got = (await request(app).get(`/api/listings/${listing.id}`)).body as Listing;
    expect(got.photos.map((p) => [p.id, p.position])).toEqual([
      [photos[0]!.id, 0],
      [photos[2]!.id, 1],
    ]);
    expect((await seller.delete(`/api/listings/${listing.id}/photos/${victim.id}`)).status).toBe(404);
  });

  it('returns 404 for a photo of another listing or a malformed ID, 403 for strangers', async () => {
    const a = await createListing();
    const b = await createListing();
    const [photo] = (await upload(seller, a.id, [{}]).expect(201)).body as ListingPhoto[];

    expect((await seller.delete(`/api/listings/${b.id}/photos/${photo!.id}`)).status).toBe(404);
    expect((await seller.delete(`/api/listings/${a.id}/photos/nope`)).status).toBe(404);
    expect((await other.delete(`/api/listings/${a.id}/photos/${photo!.id}`)).status).toBe(403);
    expect(existsSync(fileOf(photo!))).toBe(true);
  });

  it('is not allowed on a sold listing (409)', async () => {
    const listing = await createListing();
    const [photo] = (await upload(seller, listing.id, [{}]).expect(201)).body as ListingPhoto[];
    await seller.patch(`/api/listings/${listing.id}/status`).send({ status: 'sold' }).expect(200);
    expect((await seller.delete(`/api/listings/${listing.id}/photos/${photo!.id}`)).status).toBe(409);
  });
});

describe('deleting a listing', () => {
  it('removes its photo files', async () => {
    const listing = await createListing();
    const photos = (await upload(seller, listing.id, [{}, {}]).expect(201)).body as ListingPhoto[];
    await seller.delete(`/api/listings/${listing.id}`).expect(204);
    for (const photo of photos) expect(existsSync(fileOf(photo))).toBe(false);
  });
});

describe('temp upload dir', () => {
  it('is empty after all requests, successful or not', async () => {
    expect(await tempFileCount()).toBe(0);
  });

  it('is not served', async () => {
    expect((await request(app).get('/uploads/tmp/anything')).status).toBe(404);
  });
});
