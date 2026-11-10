import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit({ adapter: adapter(), alias: { $seo: 'src/seo' } }),
    svelteVitals({ outFile: 'svelte-vitals-report.json' })
  ]
});
