import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { TRUSTED_ORIGIN } from './helpers.js';

const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('CORS', () => {
  it('allows a trusted origin with credentials', async () => {
    const res = await request(app).get('/api/categories').set('Origin', TRUSTED_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(TRUSTED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('answers preflights for API and auth endpoints', async () => {
    for (const path of ['/api/listings/x', '/api/auth/sign-in/email']) {
      const res = await request(app)
        .options(path)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'content-type');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(TRUSTED_ORIGIN);
      expect(res.headers['access-control-allow-methods']).toContain('PATCH');
      expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    }
  });

  it('does not allow an unknown origin', async () => {
    const res = await request(app).get('/api/categories').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
