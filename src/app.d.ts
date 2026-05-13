/// <reference types="@cloudflare/workers-types" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/svelte" />

declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        displayName: string | null;
        role: 'user' | 'admin';
      } | null;
      sessionId: string | null;
    }
    interface PageData {
      user: App.Locals['user'];
    }
    interface Platform {
      env: {
        DB: D1Database;
        POCKET_ID_ISSUER: string;
        POCKET_ID_CLIENT_ID: string;
        POCKET_ID_CLIENT_SECRET: string;
        POCKET_ID_REDIRECT_URI: string;
        SESSION_SECRET: string;
        APP_ORIGIN: string;
      };
      context: { waitUntil(p: Promise<unknown>): void };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
