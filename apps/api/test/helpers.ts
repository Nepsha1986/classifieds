import { randomUUID } from 'node:crypto';
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
