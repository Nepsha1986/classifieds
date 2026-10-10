import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { getAuth, requireAuth } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error-handler.js';

// A bare app with one protected route, sharing the real auth handler for sign-up.
const authApp = createApp();
const app = express();
app.get('/protected', requireAuth, (req, res) => {
  res.json({ userId: getAuth(req).user.id });
});
app.use(errorHandler);

afterAll(async () => {
  await pool.end();
});

describe('requireAuth', () => {
  it('rejects requests without a session', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('rejects an invalid session cookie', async () => {
    const res = await request(app).get('/protected').set('Cookie', 'better-auth.session_token=garbage');
    expect(res.status).toBe(401);
  });

  it('loads the session onto req.auth', async () => {
    const signUp = await request(authApp)
      .post('/api/auth/sign-up/email')
      .send({ email: 'require-auth@test.io', password: 'password123', name: 'Req' });
    expect(signUp.status).toBe(200);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', signUp.get('Set-Cookie') ?? []);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: signUp.body.user.id });
  });
});
