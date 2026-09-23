import { defineConfig } from 'vitest/config';

// Standalone config so vitest doesn't pick up vite.config.ts and load the sveltekit
// plugin for what is just a node child-process e2e test.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Every case spawns the CLI, often several times; 5 s is too tight on a loaded runner.
    testTimeout: 60_000
  }
});
