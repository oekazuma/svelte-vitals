import { defineConfig } from 'tsup';

// ESM-only by design (issue #20) — never add 'cjs'. Everything is bundled (noExternal)
// because GitHub Actions runs dist/index.js standalone — there is no `npm install`
// step for a JS action's own dependencies.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: [/.*/],
  clean: true,
  target: 'es2022',
  // Transitive CJS deps (e.g. `tunnel`, pulled in by @actions/github's proxy support)
  // call require('net')/('tls')/etc. at module scope. esbuild's ESM output has no
  // real `require` in scope for those to fall back on, so without this shim they
  // throw "Dynamic require of ... is not supported" at runtime.
  banner: {
    js: "import { createRequire as __createRequireShim } from 'node:module'; const require = __createRequireShim(import.meta.url);"
  }
});
