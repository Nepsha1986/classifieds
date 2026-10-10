import { profileSchema, publicUserSchema } from '@classifieds/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { TRUSTED_ORIGIN, signUpAgent } from './helpers.js';

const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('auth flow', () => {
  it('sign-up → me → sign-out → sign-in → me', async () => {
    const { agent, credentials, user } = await signUpAgent(app, { name: 'Flow' });

    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(profileSchema.safeParse(me.body).success).toBe(true);
    expect(me.body).toMatchObject({ id: user.id, email: credentials.email, name: 'Flow' });

    const signOut = await agent.post('/api/auth/sign-out').set('Origin', TRUSTED_ORIGIN).send({});
    expect(signOut.status).toBe(200);
    expect((await agent.get('/api/me')).status).toBe(401);

    const signIn = await agent
      .post('/api/auth/sign-in/email')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email: credentials.email, password: credentials.password });
    expect(signIn.status).toBe(200);

    const meAgain = await agent.get('/api/me');
    expect(meAgain.status).toBe(200);
    expect(meAgain.body.id).toBe(user.id);
  });

  it('rejects a wrong password', async () => {
    const { credentials } = await signUpAgent(app);
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email: credentials.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a duplicate email and a short password', async () => {
    const { credentials } = await signUpAgent(app);
    const duplicate = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ ...credentials, name: 'Again' });
    expect(duplicate.status).toBe(422);

    const short = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email: 'short-password@test.io', password: '123', name: 'Short' });
    expect(short.status).toBe(400);
  });

  it('ignores profile fields at sign-up', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email: 'signup-extra@test.io', password: 'password123', name: 'Extra', city: 'Kyiv' });
    // better-auth rejects fields declared with `input: false`.
    expect(res.status).toBe(400);
  });
});

describe('/api/me', () => {
  it('is 401 without a session', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
    expect((await request(app).patch('/api/me').send({ city: 'Kyiv' })).status).toBe(401);
  });

  it('updates name, phone and city, and clears them with empty strings', async () => {
    const { agent } = await signUpAgent(app);

    const updated = await agent
      .patch('/api/me')
      .send({ name: ' New Name ', phone: '+380671234567', city: 'Odesa' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'New Name', phone: '+380671234567', city: 'Odesa' });
    expect((await agent.get('/api/me')).body).toMatchObject({ city: 'Odesa' });

    const cleared = await agent.patch('/api/me').send({ phone: '', city: '' });
    expect(cleared.body).toMatchObject({ phone: null, city: null, name: 'New Name' });
  });

  it('returns 400 for invalid input', async () => {
    const { agent } = await signUpAgent(app);
    for (const body of [{}, { phone: 'not a phone' }, { email: 'a@b.c' }, { name: '' }]) {
      const res = await agent.patch('/api/me').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    }
    const malformed = await agent.patch('/api/me').set('Content-Type', 'application/json').send('{oops');
    expect(malformed.status).toBe(400);
  });
});

describe('GET /api/users/:id', () => {
  it('returns the public profile without the email', async () => {
    const { agent, user } = await signUpAgent(app, { name: 'Seller' });
    await agent.patch('/api/me').send({ city: 'Lviv', phone: '+380501112233' });

    const res = await request(app).get(`/api/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(publicUserSchema.strict().safeParse(res.body).success).toBe(true);
    expect(res.body).toEqual({
      id: user.id,
      name: 'Seller',
      image: null,
      phone: '+380501112233',
      city: 'Lviv',
      createdAt: expect.any(String),
    });
  });

  it('is 404 for an unknown user', async () => {
    const res = await request(app).get('/api/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
