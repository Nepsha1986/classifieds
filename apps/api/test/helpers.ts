import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';

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
