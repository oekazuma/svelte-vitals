import { defineConfig } from 'tsdown';

// ESM-only by design (issue #20) — never add 'cjs'.
export default defineConfig({
  entry: ['src/index.ts', 'src/hooks/handle.ts'],
  format: ['esm'],
  fixedExtension: false,
  dts: true,
  target: 'es2022'
});
