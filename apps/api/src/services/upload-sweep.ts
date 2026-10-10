import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { listingPhotos } from '../db/schema.js';
import { LISTING_PHOTOS_DIR, UPLOAD_TMP_DIR } from '../lib/uploads.js';

/** Files younger than this are left alone: they may belong to an upload that is still in progress. */
export const SWEEP_MIN_AGE_MS = 60 * 60 * 1000;

/**
 * Safety net for files the normal paths could not clean up (a crash mid-upload, rows removed by a
 * database-level cascade): removes stale temp uploads and photo files that no `listing_photos` row
 * references. Runs at server start.
 */
export async function sweepUploads(now = Date.now()) {
  const isStale = async (file: string) => now - (await stat(file)).mtimeMs >= SWEEP_MIN_AGE_MS;

  const staleTemp = await filterAsync(await listFiles(UPLOAD_TMP_DIR), isStale);

  const photoNames = (await listFiles(LISTING_PHOTOS_DIR)).map((f) => path.basename(f));
  const referenced = new Set<string>();
  // Chunked so a large directory does not produce one huge IN (...) list.
  for (let i = 0; i < photoNames.length; i += 1000) {
    const rows = await db
      .select({ fileName: listingPhotos.fileName })
      .from(listingPhotos)
      .where(inArray(listingPhotos.fileName, photoNames.slice(i, i + 1000)));
    for (const row of rows) referenced.add(row.fileName);
  }
  const orphanPhotos = await filterAsync(
    photoNames.filter((name) => !referenced.has(name)).map((name) => path.join(LISTING_PHOTOS_DIR, name)),
    isStale,
  );

  await Promise.all([...staleTemp, ...orphanPhotos].map((file) => rm(file, { force: true })));
  return { removedTemp: staleTemp.length, removedPhotos: orphanPhotos.length };
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => path.join(dir, e.name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function filterAsync<T>(items: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
  const keep = await Promise.all(items.map(predicate));
  return items.filter((_, i) => keep[i]);
}
