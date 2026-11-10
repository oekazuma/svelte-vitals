import { defineConfig } from 'vitest/config';

// Standalone config so vitest doesn't pick up vite.config.ts and load the sveltekit
// plugin for what is just a node child-process e2e test.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts']
  }
});
