import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __PUBLIC_SENTRY_DSN__: JSON.stringify(process.env.PUBLIC_SENTRY_DSN ?? '')
  },
  plugins: [
    sentrySvelteKit({
      autoUploadSourceMaps: Boolean(process.env.SENTRY_AUTH_TOKEN),
      sourceMapsUploadOptions: {
        org: 'rubeen',
        project: 'qr-generator',
        url: process.env.SENTRY_URL ?? 'https://sentry.rubeen.dev/',
        authToken: process.env.SENTRY_AUTH_TOKEN
      }
    }),
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/api/presets',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-presets',
              networkTimeoutSeconds: 2,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname === '/api/me',
            handler: 'NetworkOnly'
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/auth/'),
            handler: 'NetworkOnly'
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/presets/'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
});
