import { defineConfig, devices } from '@playwright/test';

// End-to-end checks against the real API and database (migrated, categories seeded). Both dev servers are
// started unless already running. Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath },
  },
  webServer: [
    {
      command: 'pnpm --filter @classifieds/api dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @classifieds/merchant dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
