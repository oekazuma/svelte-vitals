import { defineConfig } from 'tsup';

// ESM-only by design (issue #20) — never add 'cjs'.
export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  clean: true,
  target: 'es2022'
});
