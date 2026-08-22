import { defineConfig } from 'tsdown';

// ESM-only by design (issue #20) — never add 'cjs'.
export default defineConfig({
  // Object form pins `gunshi-registry`'s output filename (dist/gunshi-registry.js). No `dts` for
  // it: it's read at generator-build time by a plain .js script, never imported by a TypeScript
  // consumer. The two install/ entries exist for the same reason: scripts/gen-skills.js imports
  // them at generator time to write the repo-root skills/ copies.
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
    'gunshi-registry': 'src/gunshi/registry.ts',
    'install/skill-content': 'src/install/skill-content.ts',
    'install/improve-skill-content': 'src/install/improve-skill-content.ts'
  },
  format: ['esm'],
  fixedExtension: false,
  dts: { entry: 'src/index.ts' },
  target: 'es2022'
});
