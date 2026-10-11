import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { inArray } from 'drizzle-orm';
import type { Express } from 'express';
import request from 'supertest';
import { db } from '../src/db/client.js';
import { categories } from '../src/db/schema.js';
import { seedCategories } from '../src/db/seed.js';

/** An Origin from the default TRUSTED_ORIGINS; better-auth requires it on cookie-authenticated POSTs. */
export const TRUSTED_ORIGIN = 'http://localhost:5173';

/** Signs up a fresh user with a unique email; the returned agent keeps the session cookie. */
export async function signUpAgent(app: Express, overrides: { name?: string; password?: string } = {}) {
  const agent = request.agent(app);
  const credentials = {
    email: `user-${randomUUID()}@test.io`,
    password: overrides.password ?? 'password123',
    name: overrides.name ?? 'Test User',
  };
  const res = await agent.post('/api/auth/sign-up/email').set('Origin', TRUSTED_ORIGIN).send(credentials);
  if (res.status !== 200) throw new Error(`Sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, credentials, user: res.body.user as { id: string; email: string; name: string } };
}

/** Seeds the category tree (idempotent) and returns a leaf and a parent category ID. */
export async function seededCategories() {
  await seedCategories(db);
  const rows = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
    .where(inArray(categories.slug, ['cars', 'phones', 'transport']));
  const id = (slug: string) => rows.find((r) => r.slug === slug)!.id;
  return { cars: id('cars'), phones: id('phones'), transport: id('transport') };
}

/** A valid 1×1 red PNG, built by hand so tests need no image fixtures or libraries. */
export function pngBytes(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from([0, 0xff, 0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
