import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { config } from '../config.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

export const auth = betterAuth({
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: config.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      // Set through PATCH /api/me, not at sign-up.
      phone: { type: 'string', required: false, input: false },
      city: { type: 'string', required: false, input: false },
    },
  },
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  telemetry: { enabled: false },
});

export type AuthSession = typeof auth.$Infer.Session;
