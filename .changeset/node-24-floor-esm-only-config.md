---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Raise the minimum supported Node.js to 24.16.0 (`engines.node: >=24.16.0`) and require ESM config files. Breaking:

- Node 22/23 are no longer supported. Every supported Node loads `svelte-vitals.config.ts` natively, so the CLI's "this Node cannot load a .ts config" guidance error is gone.
- The config loader now searches `svelte-vitals.config.{js,ts}` only — a `svelte-vitals.config.mjs` is **no longer loaded**; rename it to `.js` (or `.ts`). A leftover `.mjs` fails the run loudly with a rename hint (exit 2) rather than silently analyzing with defaults. `.js` configs are parsed as ESM, so the project must be `"type": "module"` (SvelteKit's default); CommonJS projects are not supported — a `.js` config that parses as CJS now fails with a guided "config files are ESM" error, and `install --force` no longer regenerates a `.js` config as `module.exports`.
- `svelte-vitals install --client config-file` scaffolds `.ts` or `.js` (never `.mjs`), no longer consulting the running Node version.
