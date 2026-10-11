import { existsSync } from 'node:fs';
import { mkdir, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db, pool } from '../src/db/client.js';
import { listingPhotos } from '../src/db/schema.js';
import { LISTING_PHOTOS_DIR, UPLOAD_TMP_DIR } from '../src/lib/uploads.js';
import { createListing } from '../src/services/listings.service.js';
import { SWEEP_MIN_AGE_MS, sweepUploads } from '../src/services/upload-sweep.js';
import { pngBytes, seededCategories, signUpAgent } from './helpers.js';

const app = createApp();
let listingId: string;

beforeAll(async () => {
  const cats = await seededCategories();
  const seller = (await signUpAgent(app)).user.id;
  listingId = (
    await createListing(seller, {
      title: 'Sweep test',
      description: 'd',
      city: 'Kyiv',
      categoryId: cats.cars,
      price: null,
      currency: 'UAH',
      attributes: {},
    })
  ).id;
});

afterAll(async () => {
  await pool.end();
});

async function makeFile(dir: string, name: string, ageMs: number) {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, pngBytes());
  const time = new Date(Date.now() - ageMs);
  await utimes(file, time, time);
  return file;
}

describe('sweepUploads', () => {
  it('removes stale temp files and unreferenced photos, keeps fresh and referenced ones', async () => {
    const old = SWEEP_MIN_AGE_MS + 60_000;
    const staleTemp = await makeFile(UPLOAD_TMP_DIR, 'stale-upload', old);
    const freshTemp = await makeFile(UPLOAD_TMP_DIR, 'fresh-upload', 0);
    const orphan = await makeFile(LISTING_PHOTOS_DIR, 'orphan-old.png', old);
    const freshOrphan = await makeFile(LISTING_PHOTOS_DIR, 'orphan-fresh.png', 0);
    const referenced = await makeFile(LISTING_PHOTOS_DIR, 'referenced.png', old);
    await db.insert(listingPhotos).values({ listingId, fileName: 'referenced.png', position: 0 });

    const result = await sweepUploads();

    expect(existsSync(staleTemp)).toBe(false);
    expect(existsSync(orphan)).toBe(false);
    expect(existsSync(freshTemp)).toBe(true);
    expect(existsSync(freshOrphan)).toBe(true);
    expect(existsSync(referenced)).toBe(true);
    expect(result.removedTemp).toBeGreaterThanOrEqual(1);
    expect(result.removedPhotos).toBeGreaterThanOrEqual(1);
  });
});
