import { defineConfig } from 'tsup';

// ESM-only by design (issue #20) — never add 'cjs'.
export default defineConfig({
  // Object form pins `gunshi-registry`'s output filename (dist/gunshi-registry.js) — array-form
  // entries leave that to esbuild's outbase inference. No `dts` entry for it: it's read at
  // generator-build time by a plain .mjs script, never imported by a TypeScript consumer.
  entry: { index: 'src/index.ts', bin: 'src/bin.ts', 'gunshi-registry': 'src/gunshi/registry.ts' },
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  clean: true,
  target: 'es2022'
});
