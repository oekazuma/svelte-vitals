import { defineConfig } from '@svelte-vitals/core';

/** Dogfooding config file: uses the published `defineConfig` identity helper. */
export default defineConfig({
  failOn: 'info',
  metaComponents: ['Seo']
});
