import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm build && node build/index.js',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: '5173',
      HOST: '127.0.0.1',
      DB_PATH: ':memory:',
      POCKET_ID_ISSUER: 'http://localhost:4787',
      POCKET_ID_CLIENT_ID: 'test',
      POCKET_ID_CLIENT_SECRET: 'test',
      POCKET_ID_REDIRECT_URI: 'http://localhost:5173/auth/callback',
      SESSION_SECRET: 'e2e-secret-bytes-hex-xxxxxxxxxxxxx',
      APP_ORIGIN: 'http://localhost:5173'
    }
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
