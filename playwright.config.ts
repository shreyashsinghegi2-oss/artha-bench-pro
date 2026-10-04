import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
const WS_PORT = Number(process.env.E2E_WS_PORT || 8799);

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Production bundle (npm run build must have run). No provider keys: external data is mocked per test.
      command: `node dist/server.cjs`,
      env: { NODE_ENV: 'production', PORT: String(PORT) },
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx tsx e2e/fixtures/ws-fixture.ts`,
      env: { PORT: String(WS_PORT) },
      url: `http://127.0.0.1:${WS_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
