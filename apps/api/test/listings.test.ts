import { type Listing, listingSchema } from '@classifieds/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { seededCategories, signUpAgent } from './helpers.js';

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

const validInput = () => ({
  title: 'Toyota Corolla 2015',
  description: 'One owner, full service history',
  price: 1_200_000,
  currency: 'usd',
  city: 'Kyiv',
  categoryId: cats.cars,
  attributes: { mileage: 120000, fuel: 'petrol' },
});

async function createAs(agent: Agent, overrides: Record<string, unknown> = {}) {
  const res = await agent.post('/api/listings').send({ ...validInput(), ...overrides });
  expect(res.status).toBe(201);
  return res.body as Listing;
}

const setStatus = (agent: Agent, id: string, status: string) =>
  agent.patch(`/api/listings/${id}/status`).send({ status });

describe('listings CRUD', () => {
  it('creates, reads, updates and deletes a listing', async () => {
    const created = await seller.post('/api/listings').send(validInput());
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(`/api/listings/${created.body.id}`);
    expect(listingSchema.safeParse(created.body).success).toBe(true);
    expect(created.body).toMatchObject({ status: 'active', currency: 'USD', price: 1_200_000 });

    const anonymousRead = await request(app).get(`/api/listings/${created.body.id}`);
    expect(anonymousRead.status).toBe(200);
    expect(anonymousRead.body).toEqual(created.body);

    const updated = await seller
      .patch(`/api/listings/${created.body.id}`)
      .send({ title: 'Toyota Corolla 2015, new tyres', price: null, attributes: {} });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      title: 'Toyota Corolla 2015, new tyres',
      price: null,
      attributes: {},
    });
    expect(updated.body.city).toBe('Kyiv');

    expect((await seller.delete(`/api/listings/${created.body.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/listings/${created.body.id}`)).status).toBe(404);
  });

  it('returns 404 for unknown and malformed IDs', async () => {
    expect((await request(app).get('/api/listings/7d1f3a52-8b51-4b6e-9b6f-3b2f0e9a1c00')).status).toBe(404);
    expect((await request(app).get('/api/listings/not-a-uuid')).status).toBe(404);
    expect((await seller.patch('/api/listings/not-a-uuid').send({ title: 'Whatever' })).status).toBe(404);
    expect((await seller.delete('/api/listings/not-a-uuid')).status).toBe(404);
  });
});

describe('authorization', () => {
  it('requires a session for every write', async () => {
    const { id } = await createAs(seller);
    const anon = request(app);
    expect((await anon.post('/api/listings').send(validInput())).status).toBe(401);
    expect((await anon.patch(`/api/listings/${id}`).send({ title: 'Changed' })).status).toBe(401);
    expect((await anon.patch(`/api/listings/${id}/status`).send({ status: 'sold' })).status).toBe(401);
    expect((await anon.delete(`/api/listings/${id}`)).status).toBe(401);
    expect((await anon.get('/api/me/listings')).status).toBe(401);
  });

  it('forbids changing someone else’s listing (403) and leaves it intact', async () => {
    const listing = await createAs(seller);
    expect((await other.patch(`/api/listings/${listing.id}`).send({ title: 'Stolen' })).status).toBe(403);
    expect((await setStatus(other, listing.id, 'sold')).status).toBe(403);
    expect((await other.delete(`/api/listings/${listing.id}`)).status).toBe(403);
    expect((await request(app).get(`/api/listings/${listing.id}`)).body).toEqual(listing);
  });
});

describe('validation', () => {
  it.each([
    ['a too short title', { title: 'ab' }],
    ['a negative price', { price: -100 }],
    ['a fractional price', { price: 99.5 }],
    ['an invalid currency', { currency: 'dollars' }],
    ['a missing category', { categoryId: undefined }],
    ['nested attributes', { attributes: { engine: { volume: 1.6 } } }],
    ['a client-set status', { status: 'sold' }],
    ['a client-set seller', { sellerId: 'someone-else' }],
  ])('rejects %s on create (400)', async (_name, overrides) => {
    const res = await seller.post('/api/listings').send({ ...validInput(), ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects unknown and non-leaf categories (400)', async () => {
    const unknown = await seller.post('/api/listings').send({ ...validInput(), categoryId: 999_999 });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe('Unknown category');
    const parent = await seller.post('/api/listings').send({ ...validInput(), categoryId: cats.transport });
    expect(parent.status).toBe(400);
    expect(parent.body.error).toBe('Choose a subcategory');
  });

  it('rejects empty, status-changing and invalid updates (400)', async () => {
    const { id } = await createAs(seller);
    expect((await seller.patch(`/api/listings/${id}`).send({})).status).toBe(400);
    expect((await seller.patch(`/api/listings/${id}`).send({ status: 'sold' })).status).toBe(400);
    expect((await seller.patch(`/api/listings/${id}`).send({ price: 'free' })).status).toBe(400);
    expect((await seller.patch(`/api/listings/${id}`).send({ categoryId: cats.transport })).status).toBe(400);
    expect((await setStatus(seller, id, 'archived')).status).toBe(400);
  });

  it('rejects malformed JSON (400)', async () => {
    const res = await seller.post('/api/listings').set('Content-Type', 'application/json').send('{"title":');
    expect(res.status).toBe(400);
  });
});

describe('status transitions', () => {
  it('pauses, resumes and sells a listing', async () => {
    const { id } = await createAs(seller);
    for (const status of ['paused', 'active', 'paused', 'sold']) {
      const res = await setStatus(seller, id, status);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it('treats setting the current status as a no-op', async () => {
    const listing = await createAs(seller);
    const res = await setStatus(seller, listing.id, 'active');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(listing);
  });

  it('makes sold final and read-only (409), but deletable', async () => {
    const { id } = await createAs(seller);
    expect((await setStatus(seller, id, 'sold')).status).toBe(200);
    for (const status of ['active', 'paused']) {
      const res = await setStatus(seller, id, status);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(`Cannot change status from sold to ${status}`);
    }
    expect((await seller.patch(`/api/listings/${id}`).send({ price: 1 })).status).toBe(409);
    expect((await request(app).get(`/api/listings/${id}`)).body.status).toBe('sold');
    expect((await seller.delete(`/api/listings/${id}`)).status).toBe(204);
  });

  it('shows a paused listing only to its seller', async () => {
    const { id } = await createAs(seller);
    await setStatus(seller, id, 'paused');
    expect((await request(app).get(`/api/listings/${id}`)).status).toBe(404);
    expect((await other.get(`/api/listings/${id}`)).status).toBe(404);
    const own = await seller.get(`/api/listings/${id}`);
    expect(own.status).toBe(200);
    expect(own.body.status).toBe('paused');
  });
});

describe('GET /api/me/listings', () => {
  it('lists only the seller’s own listings in any status, newest first, paginated', async () => {
    const { agent } = await signUpAgent(app);
    const first = await createAs(agent, { title: 'First item' });
    const second = await createAs(agent, { title: 'Second item' });
    const third = await createAs(agent, { title: 'Third item' });
    await setStatus(agent, second.id, 'paused');
    await setStatus(agent, third.id, 'sold');
    await createAs(other, { title: 'Not mine' });

    const all = await agent.get('/api/me/listings');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
    expect(all.body.items.map((l: Listing) => l.id)).toEqual([third.id, second.id, first.id]);
    expect(all.body.items.every((l: unknown) => listingSchema.safeParse(l).success)).toBe(true);

    const page2 = await agent.get('/api/me/listings').query({ page: 2, pageSize: 2 });
    expect(page2.body).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(page2.body.items.map((l: Listing) => l.id)).toEqual([first.id]);

    const beyond = await agent.get('/api/me/listings').query({ page: 5, pageSize: 2 });
    expect(beyond.body).toMatchObject({ items: [], total: 3 });

    const paused = await agent.get('/api/me/listings').query({ status: 'paused' });
    expect(paused.body).toMatchObject({ total: 1, items: [{ id: second.id, status: 'paused' }] });
  });

  it('returns an empty page for a new seller and validates the query', async () => {
    const { agent } = await signUpAgent(app);
    expect((await agent.get('/api/me/listings')).body).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    expect((await agent.get('/api/me/listings').query({ status: 'deleted' })).status).toBe(400);
    expect((await agent.get('/api/me/listings').query({ pageSize: 1000 })).status).toBe(400);
    expect((await agent.get('/api/me/listings').query({ page: 0 })).status).toBe(400);
  });
});
