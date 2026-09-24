import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [sveltekit(), svelteVitals({ outFile: 'svelte-vitals-report.json' })],
  resolve: {
    // Vite-only on purpose: the static analyzer reads kit.alias, never vite.config, so /clean/opaque's
    // meta component is reachable only through the metaComponents declaration.
    alias: { '@opaque-seo': fileURLToPath(new URL('./src/lib/clean/seo/OpaqueSeo.svelte', import.meta.url)) }
  },
  build: {
    // planted defect: performance/minify-disabled has no pass state, only fail
    minify: false
  }
});
