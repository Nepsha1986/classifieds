import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { TEST_UPLOAD_DIR } from './test/upload-dir.js';

for (const file of ['.env', '../../.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://classifieds:classifieds@localhost:5432/classifieds_test';

export default defineConfig({
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    environment: 'node',
    // All test files share one database, so run them one after another.
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl, UPLOAD_DIR: TEST_UPLOAD_DIR },
  },
});
