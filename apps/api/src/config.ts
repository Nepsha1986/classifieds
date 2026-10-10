import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Real environment variables win: loadEnvFile never overrides what is already set.
for (const file of [path.join(apiRoot, '.env'), path.join(apiRoot, '../../.env')]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  UPLOAD_DIR: z.string().default(path.join(apiRoot, 'uploads')),
  // Public URL of the API; better-auth builds callback URLs and cookie settings from it.
  BETTER_AUTH_URL: z.url().default('http://localhost:4000'),
  // Signing/encryption secret for sessions. Required in production.
  BETTER_AUTH_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(32).optional()),
  // Comma-separated frontend origins allowed to call auth endpoints with cookies.
  TRUSTED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

const DEV_AUTH_SECRET = 'dev-only-insecure-secret-change-me-0123456789';

export type Config = z.infer<typeof envSchema> & { BETTER_AUTH_SECRET: string };

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  if (!env.BETTER_AUTH_SECRET) {
    if (env.NODE_ENV === 'production') throw new Error('BETTER_AUTH_SECRET must be set in production');
    env.BETTER_AUTH_SECRET = DEV_AUTH_SECRET;
  }
  return { ...env, BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET };
}

export const config = loadConfig();
