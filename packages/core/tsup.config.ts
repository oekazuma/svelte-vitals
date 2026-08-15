import { defineConfig } from 'tsup';

// ESM-only by design (issue #20) — never add 'cjs'.
export default defineConfig({
  entry: ['src/index.ts', 'src/internal.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022'
});
