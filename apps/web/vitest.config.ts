import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Read @classifieds/shared from its TypeScript sources (see DECISIONS D5).
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
