import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts', 'tests/helpers/**/*.test.ts'],
    exclude: ['tests/server/api/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['tests/unit/setup.ts'],
    passWithNoTests: true
  }
});
