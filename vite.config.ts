import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			strategies: 'generateSW',
			registerType: 'prompt',
			manifest: false,
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
				navigateFallback: '/'
			}
		})
	]
});
