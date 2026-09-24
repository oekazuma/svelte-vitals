import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: '404.html'
    }),
    // Computed rather than a string literal, as real apps write it: /clean/alias imports through it.
    alias: {
      '$clean-real-world': fileURLToPath(new URL('./src/lib/clean/real-world', import.meta.url))
    },
    prerender: {
      // Several gallery routes reference asset/route paths that don't exist
      // (e.g. /img/hero.jpg, /fonts/inter.woff2, a nested-button anchor's href)
      // as rule specimens; the prerender crawler follows every href/src it finds
      // and 404s on these. Ignore every 404 rather than allowlisting each dummy
      // path — a narrower list would need updating on every new planted defect
      // that happens to reference a path that doesn't resolve.
      handleHttpError: ({ status, path, message }) => {
        if (status === 404) {
          console.warn(`prerender: ignoring expected 404 at ${path}`);
          return;
        }
        throw new Error(message);
      }
    }
  }
};

export default config;
