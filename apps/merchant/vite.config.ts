/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, loadEnv } from 'vite';

// One `.env` at the repo root serves every app (the API reads it too); only VITE_* reaches the browser.
const envDir = '../..';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  // Where the dev server forwards /api and /uploads when the app calls the API on its own origin.
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:4000';

  return {
    envDir,
    plugins: [react()],
    // Read @classifieds/shared from its TypeScript sources (see DECISIONS D5).
    resolve: { conditions: ['source', ...defaultClientConditions] },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget },
        '/uploads': { target: apiTarget },
      },
    },
    preview: { port: 5173, strictPort: true },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
