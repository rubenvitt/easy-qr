import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        d1Databases: ['DB'],
        bindings: {
          POCKET_ID_ISSUER: 'https://id.test',
          POCKET_ID_CLIENT_ID: 'test',
          POCKET_ID_CLIENT_SECRET: 'test',
          POCKET_ID_REDIRECT_URI: 'http://localhost/auth/callback',
          SESSION_SECRET: 'e2e-secret-bytes-hex-xxxxxxxxxxxxx',
          APP_ORIGIN: 'http://localhost'
        }
      }
    })
  ],
  test: {
    include: ['tests/server/api/**/*.test.ts'],
    passWithNoTests: true
  }
});
