import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));

export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib')
    }
  },
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
          APP_ORIGIN: 'http://localhost',
          TEST_MIGRATIONS: migrations
        }
      }
    })
  ],
  test: {
    include: ['tests/server/api/**/*.test.ts'],
    passWithNoTests: true
  }
});
