import { defineConfig } from 'tsup';

// ESM-only by design (issue #20) — never add 'cjs'. Everything is bundled (noExternal)
// because GitHub Actions runs dist/index.js standalone — there is no `npm install`
// step for a JS action's own dependencies.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: [/.*/],
  clean: true,
  target: 'es2022'
});
