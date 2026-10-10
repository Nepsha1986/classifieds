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
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const config = loadConfig();
