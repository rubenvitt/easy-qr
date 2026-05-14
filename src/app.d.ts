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
  }
}

export {};
