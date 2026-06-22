import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/hooks/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022'
});
