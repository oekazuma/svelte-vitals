import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit(), svelteVitals({ outFile: 'svelte-vitals-report.json' })],
  build: {
    // planted defect: performance/minify-disabled has no pass state, only fail
    minify: false
  }
});
