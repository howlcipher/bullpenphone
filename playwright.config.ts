import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'small-phone', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  // `astro preview` detaches in Astro 7, so tests use a small foreground server.
  // Build first with `npm run test:e2e`.
  webServer: {
    command: 'node scripts/serve.mjs dist-fixture 4321',
    url: 'http://localhost:4321/bullpenphone/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
